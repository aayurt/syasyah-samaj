#!/usr/bin/env bash
# =============================================================================
# Syasyah Samaj Billing API — direct curl test script
# Domain-folders, dependency-ordered, cleanup on exit (success or failure)
#
# Usage:
#   BASE=https://syasyahsamaj.com TENANT_ID=<ilaka-id> PASSWORD=<pw> ./test-apis.sh
#
# Env:
#   BASE        API base URL (default https://syasyahsamaj.com)
#   EMAIL       better-auth email (default demo@syasyahsamaj.com)
#   PASSWORD    better-auth password (REQUIRED)
#   TENANT_ID   tenant (ilaka) id for tenant-scoped calls (REQUIRED)
# =============================================================================
set -euo pipefail

BASE="${BASE:-https://syasyahsamaj.com}"
EMAIL="${EMAIL:-aayurtshrestha@gmail.com}"
PASSWORD="${PASSWORD:?set PASSWORD env var}"
TENANT_ID="${TENANT_ID:?set TENANT_ID env var}"

WORK="$(mktemp -d)"
COOKIE="$WORK/cookies.txt"
rm -f "$COOKIE"

FAIL_COUNT=0
CREATED_IDS=()   # "collection:id" pairs for fallback DELETE cleanup

log()   { echo "[INFO] $*"; }
warn()  { echo "[WARN] $*"; }
fail()  { echo "[FAIL] $*"; FAIL_COUNT=$((FAIL_COUNT+1)); }

# ── helpers ──────────────────────────────────────────────────────────────────

# http <label> <method> <url> <body_file|-> [curl extra args...]
http() {
  local label="$1"; shift
  local method="$1"; shift
  local url="$1"; shift
  local body_file="$1"; shift

  local out="$WORK/out.json"
  rm -f "$out"
  local code
  if [ "$body_file" != "-" ]; then
    code=$(curl -s -o "$out" -w "%{http_code}" -X "$method" "$url" \
      -b "$COOKIE" -c "$COOKIE" \
      -H "Content-Type: application/json" \
      -H "Origin: $BASE" \
      --data-binary "@$body_file" "$@" || echo "000")
  else
    code=$(curl -s -o "$out" -w "%{http_code}" -X "$method" "$url" \
      -b "$COOKIE" -c "$COOKIE" \
      -H "Content-Type: application/json" \
      -H "Origin: $BASE" \
      "$@" || echo "000")
  fi
  HTTP_CODE="$code"
  BODY_FILE="$out"

  if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
    log "OK   $label ($code)"
    return 0
  fi
  fail "$label (http $code)"
  cat "$out" 2>/dev/null || true
  echo
  return 1
}

# extract <var> <python-expr-on-d>
extract() {
  local var="$1"; shift
  local expr="$1"; shift
  local val
  val=$(python3 -c "import json; d=json.load(open('$BODY_FILE')); print($expr)" 2>/dev/null || true)
  printf -v "$var" '%s' "$val"
  export "$var"="${!var}"
}

# track <collection> <id>
track() { CREATED_IDS+=("$1:$2"); }

# mkjson <file> <python-expr>
# Builds a JSON body file using python3 eval() (avoids bash quoting hell).
# Pass the python expression as a single quoted arg; os.environ is available.
mkjson() {
  local file="$1"; shift
  cat > "$WORK/_mkjson.py" <<'PYEOF'
import json, os, sys
print(json.dumps(eval(sys.argv[1])))
PYEOF
  python3 "$WORK/_mkjson.py" "$@" > "$file"
  echo "$file"
}

# ── cleanup ──────────────────────────────────────────────────────────────────

cleanup() {
  local rc=$?
  echo
  echo "============================================="
  echo "CLEANUP"
  echo "============================================="

  # 1) Fallback DELETE for every individually created id (reverse order)
  # Best-effort: bulk tenant wipe (step 2) is the authoritative cleanup.
  # Individual DELETE failures must not count as test failures.
  local i coll id code
  for ((i=${#CREATED_IDS[@]}-1; i>=0; i--)); do
    IFS=':' read -r coll id <<< "${CREATED_IDS[$i]}"
    if [ -n "${id:-}" ]; then
      code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/$coll/$id" \
        -b "$COOKIE" -c "$COOKIE" -H "Origin: $BASE" 2>/dev/null || echo "000")
      [ "$code" -ge 200 ] && [ "$code" -lt 300 ] || warn "cleanup DELETE $coll/$id -> $code"
    fi
  done

  # 2) Bulk tenant wipe (best effort)
  if [ -n "${TENANT_ID:-}" ]; then
    mkjson "$WORK/cleanup.json" '{"tenant": os.environ["TENANT_ID"]}'
    http "POST /api/data-ops/cleanup (tenant=$TENANT_ID)" POST "$BASE/api/data-ops/cleanup" "$WORK/cleanup.json" >/dev/null 2>&1 || true
  fi

  rm -rf "$WORK"
  echo "Failures: $FAIL_COUNT"
  if [ "$rc" -ne 0 ] || [ "$FAIL_COUNT" -gt 0 ]; then
    echo "RESULT: FAILURE"
    exit 1
  fi
  echo "RESULT: ALL PASS"
  exit 0
}
trap cleanup EXIT

# =============================================================================
echo "============================================="
echo "Syasyah Samaj API test run"
echo "BASE=$BASE  TENANT=$TENANT_ID  EMAIL=$EMAIL"
echo "============================================="

# =============================================================================
# 00 AUTH
# =============================================================================
export EMAIL PASSWORD
mkjson "$WORK/signin.json" '{"email": os.environ["EMAIL"], "password": os.environ["PASSWORD"]}'
http "sign-in" POST "$BASE/api/auth/sign-in/email" "$WORK/signin.json"

# ── pre-cleanup: wipe orphaned test data from prior failed runs ──
mkjson "$WORK/precleanup.json" '{"tenant": os.environ["TENANT_ID"]}'
http "POST /api/data-ops/cleanup (pre)" POST "$BASE/api/data-ops/cleanup" "$WORK/precleanup.json" >/dev/null 2>&1 || true

# =============================================================================
# 01 SETTINGS
# =============================================================================
http "GET billing-settings" GET "$BASE/api/globals/billing-settings" "-"

# =============================================================================
# 02 MASTERS (CRUD)
# =============================================================================

export AG_CODE ACCT_CODE PARTY_NAME ITEM_CODE TENANT_ID

# --- account groups ---
AG_CODE="test-ag-$(date +%s)"
export AG_CODE
mkjson "$WORK/agroup.json" '{"code": os.environ["AG_CODE"], "name": "Test Group", "type": "asset", "sortOrder": 999}'
http "POST account-groups" POST "$BASE/api/account-groups" "$WORK/agroup.json"
extract agroupId 'd.get("doc",{}).get("id")'
track "account-groups" "$agroupId"

# --- accounts ---
ACCT_CODE="1999-$(date +%s)"
export ACCT_CODE
mkjson "$WORK/account.json" '{"code": os.environ["ACCT_CODE"], "name": "Test Account", "type": "asset", "class": "other", "group": int(os.environ["agroupId"]), "currency": "NPR", "tenant": int(os.environ["TENANT_ID"])}'
http "POST accounts" POST "$BASE/api/gl-accounts" "$WORK/account.json"
extract accountId 'd.get("doc",{}).get("id")'
track "gl-accounts" "$accountId"

http "GET accounts/:id" GET "$BASE/api/gl-accounts/$accountId" "-"

# --- parties ---
PARTY_NAME="Test Party $(date +%s)"
export PARTY_NAME
mkjson "$WORK/party.json" '{"name": os.environ["PARTY_NAME"], "type": "customer", "email": "test@example.com", "phone": "9800000000", "openingBalance": 0, "receivableAccount": int(os.environ["accountId"]), "tenant": int(os.environ["TENANT_ID"])}'
http "POST parties" POST "$BASE/api/parties" "$WORK/party.json"
extract partyId 'd.get("doc",{}).get("id")'
track "parties" "$partyId"

# --- items ---
ITEM_CODE="TEST-$(date +%s)"
export ITEM_CODE
mkjson "$WORK/item.json" '{"code": os.environ["ITEM_CODE"], "name": "Test Item", "unit": "pcs", "salePrice": 100, "purchasePrice": 60, "reorderLevel": 5, "tenant": int(os.environ["TENANT_ID"])}'
http "POST items" POST "$BASE/api/items" "$WORK/item.json"
extract itemId 'd.get("doc",{}).get("id")'
track "items" "$itemId"

# --- stock: add qtyIn so sales invoice can post ---
mkjson "$WORK/stock.json" '{"item": int(os.environ["itemId"]), "qtyIn": 5, "unitCost": 60, "tenant": int(os.environ["TENANT_ID"])}'
http "POST stock-movements" POST "$BASE/api/stock-movements" "$WORK/stock.json"
extract stockId 'd.get("doc",{}).get("id") or d.get("id")'
track "stock-movements" "$stockId"

# --- fiscal years: reuse existing FY Test or create far in future (no overlap) ---
http "GET fiscal-years (lookup)" GET "$BASE/api/fiscal-years?tenant=$TENANT_ID&limit=100" "-"
export fyId=$(python3 -c "
import json
d = json.load(open('$BODY_FILE'))
for item in d.get('docs', []):
    label = item.get('label', '')
    if label == 'FY Test Permanent':
        print(item.get('id') or item.get('doc', {}).get('id'))
        break
")
if [ -z "$fyId" ]; then
  mkjson "$WORK/fy.json" '{"label": "FY Test Permanent", "startDate": "2064-01-01", "endDate": "2065-01-01", "status": "active", "tenant": int(os.environ["TENANT_ID"])}'
  http "POST fiscal-years" POST "$BASE/api/fiscal-years" "$WORK/fy.json"
  extract fyId 'd.get("doc",{}).get("id")'
fi
track "fiscal-years" "$fyId"

# =============================================================================
# 03 DOCUMENTS (vouchers)
# =============================================================================
export partyId itemId
mkjson "$WORK/voucher.json" '{"docType": "sales-invoice", "date": "2064-06-01", "party": int(os.environ["partyId"]), "narration": "API test voucher", "status": "draft", "currency": "NPR", "exchangeRate": 1, "lines": [{"description": "Test line", "qty": 2, "rate": 100, "amount": 200, "item": int(os.environ["itemId"])}]}'
http "POST documents (draft)" POST "$BASE/api/documents" "$WORK/voucher.json"
extract docId 'd.get("doc",{}).get("id") or d.get("id")'
track "documents" "$docId"

http "POST documents/:id/post" POST "$BASE/api/documents/$docId/post" "-"

# =============================================================================
# 04 REPORTS
# =============================================================================
http "GET trial-balance" GET "$BASE/api/journal-entries/trial-balance?tenant=$TENANT_ID" "-"
http "GET ledger" GET "$BASE/api/journal-entries/ledger?account=$accountId&tenant=$TENANT_ID" "-"
http "GET balances" GET "$BASE/api/gl-accounts/balances?tenant=$TENANT_ID" "-"
http "GET stock-levels" GET "$BASE/api/items/stock-levels?tenant=$TENANT_ID" "-"
http "GET valuation" GET "$BASE/api/items/valuation?tenant=$TENANT_ID" "-"
http "GET fixed-assets/register" GET "$BASE/api/fixed-assets/register?tenant=$TENANT_ID" "-"

# =============================================================================
# 05 FISCAL CLOSE
# =============================================================================
# --- successor fiscal year: reuse existing or create ---
http "GET fiscal-years (lookup successor)" GET "$BASE/api/fiscal-years?tenant=$TENANT_ID&limit=100" "-"
export nextfyId=$(python3 -c "
import json
d = json.load(open('$BODY_FILE'))
for item in d.get('docs', []):
    label = item.get('label', '')
    if label == 'FY Test Successor':
        print(item.get('id') or item.get('doc', {}).get('id'))
        break
")
if [ -z "$nextfyId" ]; then
  mkjson "$WORK/nextfy.json" '{"label": "FY Test Successor", "startDate": "2065-01-02", "endDate": "2066-01-02", "status": "active", "tenant": int(os.environ["TENANT_ID"])}'
  http "POST fiscal-years (successor)" POST "$BASE/api/fiscal-years" "$WORK/nextfy.json"
  extract nextfyId 'd.get("id")'
fi
track "fiscal-years" "$nextfyId"

# =============================================================================
# 06 OPENING BALANCES
# =============================================================================
http "GET opening-balances/for-year" GET "$BASE/api/opening-balances/for-year?fiscalYear=$fyId&tenant=$TENANT_ID" "-"

export fyId accountId
mkjson "$WORK/obwizard.json" '{"fiscalYear": int(os.environ["fyId"]), "tenant": int(os.environ["TENANT_ID"]), "balances": [{"account": int(os.environ["accountId"]), "amount": 0}]}'
http "POST opening-balances/save-wizard" POST "$BASE/api/opening-balances/save-wizard" "$WORK/obwizard.json"

http "POST fiscal-years/:id/close" POST "$BASE/api/fiscal-years/$fyId/close" "-" || true

# =============================================================================
# 07 EXPENSE CLAIMS
# =============================================================================
export partyId accountId TENANT_ID
mkjson "$WORK/claim.json" '{"status": "draft", "claimant": os.environ["partyId"], "date": "2065-06-01", "party": int(os.environ["partyId"]), "lines": [{"description": "Test expense", "amount": 500, "account": int(os.environ["accountId"])}], "tenant": int(os.environ["TENANT_ID"])}'
http "POST expense-claims" POST "$BASE/api/expense-claims" "$WORK/claim.json"
extract claimId 'd.get("doc",{}).get("id")'
track "expense-claims" "$claimId"

http "POST expense-claims/:id/submit" POST "$BASE/api/expense-claims/$claimId/submit" "-"
http "POST expense-claims/:id/approve" POST "$BASE/api/expense-claims/$claimId/approve" "-"

# =============================================================================
# 08 BANK RECONCILIATION
# =============================================================================
export accountId TENANT_ID
mkjson "$WORK/bankimport.json" '{"account": int(os.environ["accountId"]), "periodStart": "2026-07-01", "periodEnd": "2026-07-31", "openingBalance": 0, "closingBalance": 1000, "csv": "date,description,amount\n2026-07-10,Test deposit,1000\n"}'
http "POST bank-statements/import" POST "$BASE/api/bank-statements/import" "$WORK/bankimport.json"
extract stmtId 'd.get("statement",{}).get("id") or d.get("id")'
track "bank-statements" "$stmtId"

http "POST bank-statements/:id/reconcile" POST "$BASE/api/bank-statements/$stmtId/reconcile" "-"

# =============================================================================
echo
echo "============================================="
echo "CORE DOMAINS PASSED: auth, settings, masters (CRUD),"
echo "  documents (post), reports, fiscal-close, opening-balances,"
echo "  expense-claims (submit/approve), bank-recon (import/reconcile)"
echo "============================================="

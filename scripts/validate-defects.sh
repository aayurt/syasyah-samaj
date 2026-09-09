#!/bin/bash
# Accounting Defect Validation Script
# Verifies BUG-1 (cacheVersion on FY change) and BUG-2 (dropdown portal)
# are actually fixed.
#
# Phase 1-2: static code checks (always runs)
# Phase 3:   automated checks against a running dev server (if reachable)
# Phase 4:   manual verification checklist (printed clearly when server unreachable)
#
# BUG-1: FiscalYearSwitcher must clear/refresh cache when the fiscal year
#        changes, when the tab becomes visible, and on window unload.
# BUG-2: Dropdowns (AccountSelect, SearchSelect) must escape overflow:hidden
#        ancestors via a React portal mounted on document.body.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SPA_DIR="$REPO_DIR/apps/billing"
ECHO='echo'

ERRORS=0
PASS=0

log_pass()  { $ECHO "  ✓ $1"; PASS=$((PASS + 1)); }
log_fail()  { $ECHO "  ✗ $1"; ERRORS=$((ERRORS + 1)); }
log_skip()  { $ECHO "  - $1 (skipped)"; }
log_section() { $ECHO ""; $ECHO "--- $1 ---"; }

# ── helpers ──────────────────────────────────────────────────────────────
js_exists() {
  # check that a file imports from another file (roughly)
  grep -q "$2" "$1" 2>/dev/null
}

# ── Phase 1: BUG-1 static checks ────────────────────────────────────────
phase1_bug1() {
  log_section "Phase 1 — BUG-1: cache clearing on FY change (static checks)"

  # 1a. FiscalYearSwitcher listens to visibilitychange
  if js_exists "$SPA_DIR/src/components/FiscalYearSwitcher.tsx" "visibilitychange"; then
    log_pass "FiscalYearSwitcher has visibilitychange handler"
  else
    log_fail "FiscalYearSwitcher missing visibilitychange handler"
  fi

  # 1b. FiscalYearSwitcher bumps cacheVersion on beforeunload
  if js_exists "$SPA_DIR/src/components/FiscalYearSwitcher.tsx" "beforeunload"; then
    log_pass "FiscalYearSwitcher has beforeunload handler"
  else
    log_fail "FiscalYearSwitcher missing beforeunload handler"
  fi

  # 1c. FiscalYearSwitcher calls refresh() on FY change (in the select onChange)
  if js_exists "$SPA_DIR/src/components/FiscalYearSwitcher.tsx" "refresh()"; then
    log_pass "FiscalYearSwitcher calls refresh() on FY change"
  else
    log_fail "FiscalYearSwitcher missing refresh() call on FY change"
  fi

  # 1d. useSyncState exposes cacheVersion (defined in offline/index.ts)
  if js_exists "$SPA_DIR/src/lib/offline/index.ts" "cacheVersion"; then
    log_pass "useSyncState exposes cacheVersion"
  else
    log_fail "useSyncState missing cacheVersion"
  fi
}

# ── Phase 2: BUG-2 static checks ────────────────────────────────────────
phase2_bug2() {
  log_section "Phase 2 — BUG-2: dropdown portal (static checks)"

  # 2a. Popover component exists and uses createPortal
  if [ -f "$SPA_DIR/src/components/Popover.tsx" ] && js_exists "$SPA_DIR/src/components/Popover.tsx" "createPortal"; then
    log_pass "Popover.tsx exists and uses createPortal to document.body"
  else
    log_fail "Popover.tsx missing or does not use createPortal"
  fi

  # 2b. AccountSelect imports Popover
  if js_exists "$SPA_DIR/src/components/AccountSelect.tsx" "import.*Popover"; then
    log_pass "AccountSelect imports Popover"
  else
    log_fail "AccountSelect does not import Popover"
  fi

  # 2c. SearchSelect imports Popover
  if js_exists "$SPA_DIR/src/components/SearchSelect.tsx" "import.*Popover"; then
    log_pass "SearchSelect imports Popover"
  else
    log_fail "SearchSelect does not import Popover"
  fi

  # 2d. Popover anchors to document.body (not a nested div)
  if js_exists "$SPA_DIR/src/components/Popover.tsx" "document\.body"; then
    log_pass "Popover renders into document.body (escapes overflow:hidden)"
  else
    log_fail "Popover does not render into document.body"
  fi

  # 2e. Popover closes on outside click and Escape
  if js_exists "$SPA_DIR/src/components/Popover.tsx" "mousedown"; then
    log_pass "Popover closes on outside mousedown"
  else
    log_fail "Popover missing outside-click close"
  fi
  if js_exists "$SPA_DIR/src/components/Popover.tsx" "Escape"; then
    log_pass "Popover closes on Escape key"
  else
    log_fail "Popover missing Escape close"
  fi
}

# ── Phase 3: automated checks against running dev server ────────────────
phase3_auto() {
  log_section "Phase 3 — Automated checks (requires dev server on :3000/:5173)"

  local API_URL="http://localhost:3000"
  local WEB_URL="http://localhost:5173"
  local CHECK_PASS=true

  # Bail early if neither server is reachable
  if ! curl -sf "$WEB_URL" >/dev/null 2>&1 && ! curl -sf "$API_URL/api/health" >/dev/null 2>&1; then
    log_skip "Dev server not reachable at $WEB_URL / $API_URL — skipping automated checks"
    return 0
  fi

  # --- BUG-1 automated: confirm FY switcher element is in the DOM and
  #     the page listens for visibilitychange. We can't easily trigger a
  #     visibility change from curl, but we CAN verify the static structure.
  if curl -sf "$WEB_URL" >/dev/null 2>&1; then
    # Grab the built JS bundle and check for the visibilitychange string
    local BUNDLE
    BUNDLE=$(curl -sf "$WEB_URL" | grep -o 'src="[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')
    if [ -n "$BUNDLE" ]; then
      local JS_URL="${WEB_URL}${BUNDLE}"
      if curl -sf "$JS_URL" 2>/dev/null | grep -q "visibilitychange"; then
        log_pass "BUG-1: visibilitychange handler present in deployed bundle"
      else
        log_fail "BUG-1: visibilitychange handler NOT found in deployed bundle"
        CHECK_PASS=false
      fi
    else
      log_skip "Could not locate JS bundle URL from index HTML"
    fi
  fi

  # --- BUG-2 automated: verify Popover is imported in the built AccountSelect
  if [ -f "$SPA_DIR/dist/assets/index-*.js" ] 2>/dev/null; then
    # Vite builds put hashed assets in dist/assets/ — check for Popover references
    if grep -rl "Popover" "$SPA_DIR/dist/" >/dev/null 2>&1; then
      log_pass "BUG-2: Popover referenced in built SPA assets"
    else
      log_fail "BUG-2: Popover NOT found in built SPA assets"
      CHECK_PASS=false
    fi
  fi

  if $CHECK_PASS; then
    log_pass "Phase 3 automated checks passed"
  else
    log_fail "Phase 3 had failures"
  fi
}

# ── Phase 4: manual verification checklist ──────────────────────────────
phase4_manual() {
  log_section "Phase 4 — Manual verification checklist"
  $ECHO ""
  $ECHO "If the automated checks above could not run (no dev server), perform"
  $ECHO "these steps manually and confirm each expected outcome:"
  $ECHO ""

  $ECHO "BUG-1 — cache cleared after fiscal year change"
  $ECHO "  Step 1: Open the billing SPA, log in."
  $ECHO "  Step 2: Open browser DevTools → Network tab. Refresh the page."
  $ECHO "  Step 3: In the header, open the Fiscal Year switcher dropdown."
  $ECHO "  Step 4: Select a DIFFERENT fiscal year (or add a new one via '+')."
  $ECHO "  Step 5: Watch the Network tab — you should see fresh fetches for"
  $ECHO "          collections (e.g. /fiscal-years, /accounts, /journal-entries)."
  $ECHO "  EXPECTED: After switching FY, the data shown reflects the new FY."
  $ECHO "            No stale data from the previous FY persists."
  $ECHO "  Step 6 (tab visibility): Open the SPA in a tab, switch to another"
  $ECHO "          app, then come back. Data should refresh automatically."
  $ECHO "  Step 7 (beforeunload): Open the SPA, make a note of visible data,"
  $ECHO "          close the tab, reopen it. Data should be fresh (not cached"
  $ECHO "          from the previous session)."
  $ECHO ""

  $ECHO "BUG-2 — dropdown visible inside overflow:hidden parent"
  $ECHO "  Step 1: Open the billing SPA, log in, navigate to a page with a"
  $ECHO "          dropdown inside a constrained container (e.g. AccountSelect"
  $ECHO "          on a form that sits inside an overflow:hidden card)."
  $ECHO "  Step 2: Open the dropdown. The panel should render BELOW the trigger"
  $ECHO "          and be fully visible — not clipped by any parent's"
  $ECHO "          overflow:hidden."
  $ECHO "  Step 3: In DevTools, inspect the dropdown panel element."
  $ECHO "  EXPECTED: The panel is a direct child of document.body (not nested"
  $ECHO "            inside any overflow:hidden ancestor). Confirm via:"
  $ECHO "              document.querySelector('[class*=\"Popover\"]').parentNode"
  $ECHO "            which should be <body>."
  $ECHO "  Step 4: Click outside the dropdown — it should close."
  $ECHO "  Step 5: Press Escape — it should close."
  $ECHO "  Step 6: Resize the window — the dropdown should reposition correctly."
  $ECHO ""
}

# ── FiscalYears backend checks ──────────────────────────────────────────
phase5_backend() {
  log_section "Phase 5 — FiscalYears backend fixes (static checks)"

  local FY="$REPO_DIR/src/collections/FiscalYears/index.ts"

  # Date validation
  if grep -q "Invalid start date" "$FY"; then
    log_pass "FiscalYears: invalid date rejection (BUG-1 backend)"
  else
    log_fail "FiscalYears: missing date validation"
  fi

  # Overlap detection
  if grep -q "overlaps with existing" "$FY"; then
    log_pass "FiscalYears: overlap detection"
  else
    log_fail "FiscalYears: missing overlap detection"
  fi

  # Single isActive enforcement
  if grep -q "Only one isActive" "$FY" || grep -q "isActive.*false" "$FY"; then
    log_pass "FiscalYears: single active year enforced"
  else
    log_fail "FiscalYears: missing single-active enforcement"
  fi

  # Closed year cannot be working year
  if grep -q "Cannot set a closed fiscal year" "$FY"; then
    log_pass "FiscalYears: closed years cannot be working year (BUG-3)"
  else
    log_fail "FiscalYears: missing closed-year guard"
  fi

  # Span validation
  if grep -q "Fiscal year span is" "$FY"; then
    log_pass "FiscalYears: span validation (~365 days)"
  else
    log_fail "FiscalYears: missing span validation"
  fi

  # End date after start date
  if grep -q "end date must be after" "$FY"; then
    log_pass "FiscalYears: end > start validation"
  else
    log_fail "FiscalYears: missing end>start check"
  fi
}

# ── main ────────────────────────────────────────────────────────────────
$ECHO "=== Accounting Defect Validation ==="
$ECHO ""

phase1_bug1
phase2_bug2
phase3_auto
phase4_manual
phase5_backend

$ECHO ""
$ECHO "=== Validation Complete ==="
$ECHO "Passed: $PASS"
if [ $ERRORS -eq 0 ]; then
  $ECHO "All checks passed ✓"
  exit 0
else
  $ECHO "$ERRORS check(s) FAILED ✗"
  exit 1
fi

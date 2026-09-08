#!/bin/bash
# UI Cleanup Automation Script for Syasyah Samaj
# Run from the syasyah-samaj directory: bash docs/UI-CLEANUP-AUTO.sh

set -e

echo "=== Syasyah Samaj UI Cleanup ==="
echo ""

# Phase 1: Remove dead code & stray files
echo "[Phase 1] Removing dead code and stray files..."

# 1.1 Delete stray duplicate directories
if [ -d "src/app/%5Blocale%5D" ]; then
  rm -rf "src/app/%5Blocale%5D"
  echo "  ✓ Deleted src/app/%5Blocale%5D/"
fi

if [ -d "src/app/\\[locale\\]" ]; then
  rm -rf "src/app/\\[locale\\]"
  echo "  ✓ Deleted src/app/\\[locale\\]/"
fi

# 1.2 Delete stray files
if [ -f "…ndex.tsx" ]; then
  rm -f "…ndex.tsx"
  echo "  ✓ Deleted …ndex.tsx (stray DigitalIDCard duplicate)"
fi

if [ -f "src/components/MemberEntryForm.tsx" ]; then
  rm -f "src/components/MemberEntryForm.tsx"
  echo "  ✓ Deleted src/components/MemberEntryForm.tsx (broken component)"
fi

echo ""

# Phase 2: Fix hardcoded values
echo "[Phase 2] Fixing hardcoded values..."

# 2.1 IlakaTabs - add comment for excluded tenant
ILAKA_TABS="src/app/[locale]/(frontend)/components/Ilakas/IlakaTabs.tsx"
if [ -f "$ILAKA_TABS" ]; then
  # Add comment above EXCLUDED_TENANT_IDS
  sed -i 's/^const EXCLUDED_TENANT_IDS/\/\/ Tenant ID 2 (Central) is excluded from ilaka tabs\nconst EXCLUDED_TENANT_IDS/' "$ILAKA_TABS"
  echo "  ✓ Added comment for EXCLUDED_TENANT_IDS in IlakaTabs.tsx"
fi

# 2.2 Members page - extract constant
MEMBERS_PAGE="src/app/[locale]/(frontend)/members/page.tsx"
if [ -f "$MEMBERS_PAGE" ]; then
  # Add constant at top after imports
  sed -i '/^import.*lucide-react/a\\nconst FALLBACK_MEMBER_ID = '\''SY-NEW'\''' "$MEMBERS_PAGE"
  # Replace hardcoded string
  sed -i "s/'SY-NEW'/FALLBACK_MEMBER_ID/g" "$MEMBERS_PAGE"
  echo "  ✓ Extracted FALLBACK_MEMBER_ID constant in members/page.tsx"
fi

echo ""

# Phase 3: Styling consistency
echo "[Phase 3] Fixing styling inconsistencies..."

# 3.1 Fix Members section double padding
MEMBERS_SECTION="src/app/[locale]/(frontend)/components/Members/index.tsx"
if [ -f "$MEMBERS_SECTION" ]; then
  # Remove inner p-6 from the div inside Card
  sed -i 's/<div className="relative rounded-\[14px\] p-6 text-center/<div className="relative rounded-[14px] text-center/' "$MEMBERS_SECTION"
  echo "  ✓ Fixed double padding in Members section"
fi

# 3.4 Fix Footer hardcoded colors
FOOTER="src/Footer/Component.tsx"
if [ -f "$FOOTER" ]; then
  sed -i 's/bg-gray-900/bg-card/g' "$FOOTER"
  sed -i 's/border-gray-700/border-border/g' "$FOOTER"
  sed -i 's/text-gray-400/text-muted-foreground/g' "$FOOTER"
  echo "  ✓ Fixed Footer hardcoded colors to use theme variables"
fi

# 3.5 Fix EventCard hardcoded colors
EVENT_CARD="src/app/[locale]/(frontend)/components/Events/EventCard.tsx"
if [ -f "$EVENT_CARD" ]; then
  sed -i 's/bg-red-900\/90/bg-primary\/90/g' "$EVENT_CARD"
  sed -i 's/text-red-900/text-primary/g' "$EVENT_CARD"
  sed -i 's/text-gray-500/text-muted-foreground/g' "$EVENT_CARD"
  sed -i 's/text-gray-600/text-muted-foreground/g' "$EVENT_CARD"
  sed -i 's/dark:text-gray-400/dark:text-muted-foreground/g' "$EVENT_CARD"
  sed -i 's/text-red-700/text-primary/g' "$EVENT_CARD"
  echo "  ✓ Fixed EventCard hardcoded colors to use theme variables"
fi

echo ""

# Phase 4: Component fixes
echo "[Phase 4] Fixing component issues..."

# 4.1 Logo - add dimensions to prevent CLS
LOGO="src/components/Logo/Logo.tsx"
if [ -f "$LOGO" ]; then
  sed -i 's/className={clsx('\''max-w-\[9.375rem\] w-full h=\[100px\]'\'', className)}/className={clsx('\''max-w-[9.375rem] w-full h-[100px]'\'', className)} width="150" height="100"/' "$LOGO"
  echo "  ✓ Added width/height to Logo images for CLS prevention"
fi

echo ""

# Verification
echo "=== Verification ==="
echo ""
echo "Files remaining that should be deleted:"
ls -la "src/app/%5Blocale%5D" 2>/dev/null && echo "  ⚠ %5Blocale%5D still exists!" || echo "  ✓ %5Blocale%5D removed"
ls -la "src/app/\\[locale\\]" 2>/dev/null && echo "  ⚠ \\[locale\\] still exists!" || echo "  ✓ \\[locale\\] removed"
ls -la "…ndex.tsx" 2>/dev/null && echo "  ⚠ …ndex.tsx still exists!" || echo "  ✓ …ndex.tsx removed"
ls -la "src/components/MemberEntryForm.tsx" 2>/dev/null && echo "  ⚠ MemberEntryForm.tsx still exists!" || echo "  ✓ MemberEntryForm.tsx removed"

echo ""
echo "=== Git Status ==="
git status --short

echo ""
echo "=== Cleanup Complete ==="
echo "Review changes above, then run:"
echo "  git add -A && git commit -m 'fix: cleanup UI - remove dead code, fix styling consistency'"

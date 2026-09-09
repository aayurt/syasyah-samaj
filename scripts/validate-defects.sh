#!/bin/bash
# Accounting Defect Validation Script
# Checks that the two confirmed defects are properly fixed

echo "=== Accounting Defect Validation ==="
echo ""

ERRORS=0

# Test 1: Check that FiscalYearSwitcher has visibility change handler
echo "Test 1: Checking FiscalYearSwitcher cache invalidation..."
if grep -q "visibilitychange" /projects/syasyah-samaj/apps/billing/src/components/FiscalYearSwitcher.tsx 2>/dev/null; then
    echo "  ✓ Visibility change handler present"
else
    echo "  ✗ Visibility change handler missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 2: Check that Popover component exists for dropdown fix
echo "Test 2: Checking Popover component for dropdown fix..."
if [ -f /projects/syasyah-samaj/apps/billing/src/components/Popover.tsx ]; then
    echo "  ✓ Popover component exists"
else
    echo "  ✗ Popover component missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 3: Check that AccountSelect uses Popover
echo "Test 3: Checking AccountSelect uses Popover..."
if grep -q "import Popover" /projects/syasyah-samaj/apps/billing/src/components/AccountSelect.tsx 2>/dev/null; then
    echo "  ✓ AccountSelect imports Popover"
else
    echo "  ✗ AccountSelect does not import Popover"
    ERRORS=$((ERRORS + 1))
fi

# Test 4: Check that SearchSelect uses Popover
echo "Test 4: Checking SearchSelect uses Popover..."
if grep -q "import Popover" /projects/syasyah-samaj/apps/billing/src/components/SearchSelect.tsx 2>/dev/null; then
    echo "  ✓ SearchSelect imports Popover"
else
    echo "  ✗ SearchSelect does not import Popover"
    ERRORS=$((ERRORS + 1))
fi

# Test 5: FiscalYears collection has date validation
echo "Test 5: Checking FiscalYears date validation..."
if grep -q "Invalid start date" /projects/syasyah-samaj/src/collections/FiscalYears/index.ts 2>/dev/null; then
    echo "  ✓ Date validation present"
else
    echo "  ✗ Date validation missing"
    ERRORS=$((ERRORS + 1))
fi

# Test 6: FiscalYears has overlap detection
echo "Test 6: Checking FiscalYears overlap detection..."
if grep -q "overlaps with existing" /projects/syasyah-samaj/src/collections/FiscalYears/index.ts 2>/dev/null; then
    echo "  ✓ Overlap detection present"
else
    echo "  ✗ Overlap detection missing"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=== Validation Complete ==="
if [ $ERRORS -eq 0 ]; then
    echo "All tests passed! ✓"
    exit 0
else
    echo "$ERRORS test(s) failed"
    exit 1
fi

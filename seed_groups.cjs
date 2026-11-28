const { Payload } = require('payload');

const payload = new Payload({
  url: 'http://localhost:3000',
});

async function seed() {
  try {
    await payload.init({
      secret: '4ca13d993b1e2d789734dada',
    });

    // Seed account groups
    const defaultGroups = [
      // Assets
      { code: 'assets', name: 'Assets', type: 'asset', sortOrder: 1 },
      { code: 'current-assets', name: 'Current Assets', type: 'asset', sortOrder: 10, parentCode: 'assets' },
      { code: 'cash', name: 'Cash & Cash Equivalents', type: 'asset', sortOrder: 11, parentCode: 'current-assets' },
      { code: 'bank', name: 'Bank Accounts', type: 'asset', sortOrder: 12, parentCode: 'current-assets' },
      { code: 'receivables', name: 'Accounts Receivable', type: 'asset', sortOrder: 13, parentCode: 'current-assets' },
      { code: 'inventory', name: 'Inventory', type: 'asset', sortOrder: 14, parentCode: 'current-assets' },
      { code: 'prepaid', name: 'Prepaid Expenses', type: 'asset', sortOrder: 15, parentCode: 'current-assets' },
      { code: 'fixed-assets', name: 'Fixed Assets', type: 'asset', sortOrder: 20, parentCode: 'assets' },
      { code: 'fixed-asset-cost', name: 'Fixed Asset Cost', type: 'asset', sortOrder: 21, parentCode: 'fixed-assets' },
      { code: 'accum-depr', name: 'Accumulated Depreciation', type: 'asset', sortOrder: 22, parentCode: 'fixed-assets' },
      
      // Liabilities
      { code: 'liabilities', name: 'Liabilities', type: 'liability', sortOrder: 30 },
      { code: 'current-liab', name: 'Current Liabilities', type: 'liability', sortOrder: 31, parentCode: 'liabilities' },
      { code: 'payables', name: 'Accounts Payable', type: 'liability', sortOrder: 32, parentCode: 'current-liab' },
      { code: 'tax-liab', name: 'Tax Liabilities', type: 'liability', sortOrder: 33, parentCode: 'current-liab' },
      { code: 'accrued', name: 'Accrued Expenses', type: 'liability', sortOrder: 34, parentCode: 'current-liab' },
      { code: 'long-term-liab', name: 'Long-term Liabilities', type: 'liability', sortOrder: 35, parentCode: 'liabilities' },
      
      // Equity
      { code: 'equity', name: 'Equity', type: 'equity', sortOrder: 40 },
      { code: 'capital', name: 'Capital', type: 'equity', sortOrder: 41, parentCode: 'equity' },
      { code: 'retained', name: 'Retained Earnings', type: 'equity', sortOrder: 42, parentCode: 'equity' },
      
      // Income
      { code: 'income', name: 'Income', type: 'income', sortOrder: 50 },
      { code: 'sales', name: 'Sales Revenue', type: 'income', sortOrder: 51, parentCode: 'income' },
      { code: 'service-income', name: 'Service Income', type: 'income', sortOrder: 52, parentCode: 'income' },
      { code: 'other-income', name: 'Other Income', type: 'income', sortOrder: 53, parentCode: 'income' },
      { code: 'membership-fee', name: 'Membership Fee Income', type: 'income', sortOrder: 54, parentCode: 'income' },
      { code: 'donation-income', name: 'Donation Income', type: 'income', sortOrder: 55, parentCode: 'income' },
      
      // Expenses
      { code: 'expenses', name: 'Expenses', type: 'expense', sortOrder: 60 },
      { code: 'cogs', name: 'Cost of Goods Sold', type: 'expense', sortOrder: 61, parentCode: 'expenses' },
      { code: 'salary', name: 'Salary & Wages', type: 'expense', sortOrder: 62, parentCode: 'expenses' },
      { code: 'rent', name: 'Rent', type: 'expense', sortOrder: 63, parentCode: 'expenses' },
      { code: 'utilities', name: 'Utilities', type: 'expense', sortOrder: 64, parentCode: 'expenses' },
      { code: 'office', name: 'Office Supplies', type: 'expense', sortOrder: 65, parentCode: 'expenses' },
      { code: 'depreciation', name: 'Depreciation', type: 'expense', sortOrder: 66, parentCode: 'expenses' },
      { code: 'other-expense', name: 'Other Expenses', type: 'expense', sortOrder: 67, parentCode: 'expenses' },
    ];

    let created = 0;
    let skipped = 0;
    const createdByCode = new Map();

    for (const g of defaultGroups) {
      // Check if already exists
      const existing = await payload.find({
        collection: 'account-groups',
        where: { code: { equals: g.code } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      
      if (existing.docs.length > 0) {
        skipped++;
        createdByCode.set(g.code, existing.docs[0]);
        continue;
      }

      let parentId = null;
      let level = 0;
      
      if (g.parentCode) {
        const p = createdByCode.get(g.parentCode);
        if (p) {
          parentId = p.id;
          level = Number(p.level) + 1;
        }
      }

      const createdGrp = await payload.create({
        collection: 'account-groups',
        data: { ...g, parent: parentId, level },
        overrideAccess: true,
      });
      
      createdByCode.set(g.code, createdGrp);
      created++;
      console.log(`Created: ${g.code} (parent: ${g.parentCode || 'none'}, level: ${level})`);
    }

    console.log(`\nSummary: ${created} created, ${skipped} already existed`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await payload.destroy();
  }
}

seed();

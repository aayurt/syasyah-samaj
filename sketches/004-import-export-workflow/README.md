# Feature Wireframe: Import & Export Workflow (004-import-export-workflow)

## Design Goal
- **Problem:** Community staff and accountants need to bulk import member records, opening balances, and accounts from Excel/CSV (not just technical raw JSON). They also need reliable 1-click Excel/CSV exports for audits and committee meetings.
- **Workflow:** 3-step import wizard:
  1. **Upload & Type Selection:** Drag-and-drop `.csv`, `.xlsx`, or `.json` with sample template download.
  2. **Conflict Resolution Rules:** Explicit options to skip duplicates, overwrite/update existing records, or append all.
  3. **Visual Data Validation Preview:** Color-neutral badges marking valid rows vs warnings (e.g. missing blood group or phone format), with a confirmation button.
- **Export Center:** Clean collection-level export buttons (Excel, CSV, full JSON backup).

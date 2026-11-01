import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const PayrollSlips: CollectionConfig = {
  slug: 'payroll-slips',
  labels: { singular: 'Payroll Slip', plural: 'Payroll Slips' },
  admin: {
    useAsTitle: 'slipNumber',
    group: 'Payroll',
    defaultColumns: [
      'slipNumber',
      'employee',
      'employeeName',
      'period',
      'postingDate',
      'grossPay',
      'totalDeductions',
      'netPay',
      'status',
      'updatedAt',
    ],
  },
  access: {
    create: isAdmin,
    read: () => true,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [assignTenant],
  },
  fields: [
    {
      name: 'slipNumber',
      type: 'text',
      required: true,
      admin: { description: 'Salary slip identifier, e.g. SS-2026-09-001' },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      admin: { description: 'Employee this slip belongs to' },
    },
    {
      name: 'employeeName',
      type: 'text',
      admin: { description: 'Snapshot of employee name at slip time' },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'tenants',
      admin: { description: 'Company this slip belongs to' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'INR',
    },
    {
      name: 'period',
      type: 'text',
      required: true,
      admin: { description: 'Pay period, e.g. 2026-09' },
    },
    {
      name: 'postingDate',
      type: 'date',
      required: true,
      admin: { description: 'Posting date for the journal entry' },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: { description: 'Period start date' },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: { description: 'Period end date' },
    },
    {
      name: 'payrollFrequency',
      type: 'select',
      defaultValue: 'Monthly',
      options: [
        { label: 'Monthly', value: 'Monthly' },
        { label: 'Fortnightly', value: 'Fortnightly' },
        { label: 'Bimonthly', value: 'Bimonthly' },
        { label: 'Weekly', value: 'Weekly' },
        { label: 'Daily', value: 'Daily' },
      ],
    },
    {
      name: 'salaryStructure',
      type: 'relationship',
      relationTo: 'salary-structures',
      admin: { description: 'Structure used to compute this slip' },
    },
    {
      name: 'salaryStructureAssignment',
      type: 'relationship',
      relationTo: 'salary-structure-assignments',
      admin: { description: 'Assignment used to compute this slip' },
    },
    {
      name: 'payrollRun',
      type: 'relationship',
      relationTo: 'payroll-runs',
      admin: { description: 'Payroll run this slip belongs to' },
    },
    {
      name: 'department',
      type: 'text',
    },
    {
      name: 'designation',
      type: 'text',
    },
    {
      name: 'branch',
      type: 'text',
    },
    {
      name: 'totalWorkingDays',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'paymentDays',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'leaveWithoutPay',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'absentDays',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'salaryMode',
      type: 'text',
      admin: { description: 'Employee salary mode (cash/bank)' },
    },
    {
      name: 'bankName',
      type: 'text',
    },
    {
      name: 'bankAccountNumber',
      type: 'text',
      admin: { description: 'Employee bank account (masked as needed)' },
    },
    {
      name: 'base',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Base pay used for this slip' },
    },
    {
      name: 'variable',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Variable pay used for this slip' },
    },

    // Earnings snapshot (Salary Detail)
    {
      name: 'earnings',
      type: 'array',
      admin: { description: 'Earning lines for this slip' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components' },
        { name: 'label', type: 'text' },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'isTaxApplicable', type: 'checkbox', defaultValue: true },
        { name: 'exemptedFromIncomeTax', type: 'checkbox', defaultValue: false },
        { name: 'doNotIncludeInTotal', type: 'checkbox', defaultValue: false },
      ],
    },

    // Deductions snapshot (Salary Detail)
    {
      name: 'deductions',
      type: 'array',
      admin: { description: 'Deduction lines for this slip' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components' },
        { name: 'label', type: 'text' },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'isTaxApplicable', type: 'checkbox', defaultValue: true },
        { name: 'doNotIncludeInTotal', type: 'checkbox', defaultValue: false },
        { name: 'doNotIncludeInAccounts', type: 'checkbox', defaultValue: false },
      ],
    },

    // Employer contributions snapshot (Salary Detail)
    {
      name: 'employerContributions',
      type: 'array',
      admin: { description: 'Employer contribution lines for this slip' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components' },
        { name: 'label', type: 'text' },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'doNotIncludeInTotal', type: 'checkbox', defaultValue: false },
        { name: 'doNotIncludeInAccounts', type: 'checkbox', defaultValue: false },
      ],
    },

    // Salary slip leave details (parity with frappe)
    {
      name: 'leaveDetails',
      type: 'array',
      admin: { description: 'Leave details for this slip' },
      fields: [
        { name: 'leaveType', type: 'text' },
        { name: 'days', type: 'number', defaultValue: 0 },
        { name: 'paidDays', type: 'number', defaultValue: 0 },
        { name: 'unpaidDays', type: 'number', defaultValue: 0 },
      ],
    },

    // Timesheets (parity with frappe)
    {
      name: 'timesheets',
      type: 'array',
      admin: { description: 'Timesheet references for this slip' },
      fields: [
        { name: 'timesheet', type: 'text', admin: { description: 'Timesheet reference' } },
        { name: 'days', type: 'number', defaultValue: 0 },
        { name: 'amount', type: 'number', defaultValue: 0 },
      ],
    },

    // Accrued benefits (parity with frappe)
    {
      name: 'accruedBenefits',
      type: 'array',
      admin: { description: 'Accrued benefits for this slip' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components' },
        { name: 'label', type: 'text' },
        { name: 'amount', type: 'number', defaultValue: 0 },
      ],
    },

    {
      name: 'grossPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total gross pay' },
    },
    {
      name: 'totalEarnings',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total earnings' },
    },
    {
      name: 'totalDeductionsAmount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total deductions' },
    },
    {
      name: 'totalEmployerContributions',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total employer contributions' },
    },
    {
      name: 'netPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Net pay' },
    },
    {
      name: 'roundedTotal',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Rounded total' },
    },
    {
      name: 'employeeGrossPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Employee gross pay (employee share)' },
    },
    {
      name: 'employerGrossPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Employer gross pay (employer share)' },
    },
    {
      name: 'employeeTotalDeduction',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Employee total deduction' },
    },
    {
      name: 'employerTotalContribution',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Employer total contribution' },
    },
    {
      name: 'employeeNetPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Employee net pay' },
    },
    {
      name: 'employerNetPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Employer net pay' },
    },
    {
      name: 'ctc',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Cost to company' },
    },
    {
      name: 'annualTaxableAmount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Annual taxable amount' },
    },
    {
      name: 'totalIncomeTax',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total income tax' },
    },
    {
      name: 'incomeTaxDeductedTillDate',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Income tax deducted till date' },
    },
    {
      name: 'currentMonthIncomeTax',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Current month income tax' },
    },
    {
      name: 'yearToDate',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Year to date' },
    },
    {
      name: 'monthToDate',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Month to date' },
    },
    {
      name: 'taxableEarningsTillDate',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Taxable earnings till date' },
    },
    {
      name: 'taxDeductedTillDate',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Tax deducted till date' },
    },

    {
      name: 'status',
      type: 'select',
      defaultValue: 'Draft',
      options: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Submitted', value: 'Submitted' },
        { label: 'Cancelled', value: 'Cancelled' },
      ],
    },
    {
      name: 'journalEntry',
      type: 'relationship',
      relationTo: 'journal-entries',
      admin: { description: 'Journal entry created for this slip' },
    },
    {
      name: 'paymentJournalEntry',
      type: 'relationship',
      relationTo: 'journal-entries',
      admin: { description: 'Journal entry created for payment' },
    },
    {
      name: 'paidAt',
      type: 'date',
      admin: { description: 'Date when payment was made' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who created this slip' },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who approved this slip' },
    },
    {
      name: 'notes',
      type: 'text',
      admin: { description: 'Notes for this slip' },
    },

    // Frappe parity: additional salary (for advances, loans, etc.)
    {
      name: 'additionalSalary',
      type: 'array',
      admin: { description: 'Additional salary entries (advances, loans, etc.)' },
      fields: [
        { name: 'additionalSalary', type: 'relationship', relationTo: 'additional-salaries' },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'type', type: 'text' },
      ],
    },

    // Frappe parity: loan repayment
    {
      name: 'loanRepayment',
      type: 'array',
      admin: { description: 'Loan repayment entries' },
      fields: [
        { name: 'loan', type: 'relationship', relationTo: 'loans' },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'principalAmount', type: 'number', defaultValue: 0 },
        { name: 'interestAmount', type: 'number', defaultValue: 0 },
      ],
    },

    // Frappe parity: advance recovery
    {
      name: 'advanceRecovery',
      type: 'array',
      admin: { description: 'Advance recovery entries' },
      fields: [
        { name: 'additionalSalary', type: 'relationship', relationTo: 'additional-salaries' },
        { name: 'amount', type: 'number', defaultValue: 0 },
      ],
    },

    // Frappe parity: flexible benefits
    {
      name: 'flexibleBenefits',
      type: 'array',
      admin: { description: 'Flexible benefits for this slip' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components' },
        { name: 'label', type: 'text' },
        { name: 'amount', type: 'number', defaultValue: 0 },
      ],
    },

    // Frappe parity: employee tax exemption declaration
    {
      name: 'taxExemptionDeclaration',
      type: 'relationship',
      relationTo: 'tax-exemption-declarations',
      admin: { description: 'Tax exemption declaration for this slip' },
    },

    // Frappe parity: payroll cost centers
    {
      name: 'payrollCostCenters',
      type: 'array',
      admin: { description: 'Cost center allocation for this slip' },
      fields: [
        { name: 'costCenter', type: 'text', admin: { description: 'Cost center code/name' } },
        { name: 'percentage', type: 'number', defaultValue: 100, min: 0, max: 100 },
      ],
    },
    {
      name: 'fiscalYear',
      type: 'relationship',
      relationTo: 'fiscal-years',
      required: true,
      admin: { description: 'Fiscal year this document belongs to (Frappe HR-style annual payroll period)' },
    },

    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { position: 'sidebar' },
    },
  ],
}

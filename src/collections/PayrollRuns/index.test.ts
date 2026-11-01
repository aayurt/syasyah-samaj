/**
 * Wiring tests for the payroll collections — slugs, endpoints, hooks and the
 * fields the SPA relies on. Pure config, no DB.
 */
import { Employees } from '@/collections/Employees'
import { PayrollRuns } from '@/collections/PayrollRuns'

/** Top-level field names (Payload's Field union includes unnamed containers). */
const fieldNames = (c: { fields: unknown[] }) =>
  c.fields.map((f) => (f as { name?: string }).name).filter(Boolean)

describe('Employees collection', () => {
  it('is registered with the employees slug and salary structure fields', () => {
    expect(Employees.slug).toBe('employees')
    const names = fieldNames(Employees)
    expect(names).toEqual(
      expect.arrayContaining([
        'employeeId',
        'name',
        'position',
        'active',
        'basicSalary',
        'allowances',
        'deductions',
        'tenant',
      ]),
    )
  })

  it('defaults new employees to active', () => {
    const active = Employees.fields.find((f) => (f as any).name === 'active') as any
    expect(active.defaultValue).toBe(true)
  })

  it('stamps the tenant on write', () => {
    expect(Employees.hooks?.beforeValidate?.length).toBeGreaterThan(0)
  })
})

describe('PayrollRuns collection', () => {
  it('exposes the workflow endpoints', () => {
    expect(PayrollRuns.slug).toBe('payroll-runs')
    const paths = (PayrollRuns.endpoints || []).map((e) => e.path)
    expect(paths).toEqual(['/generate', '/:id/post', '/:id/void'])
  })

  it('has the snapshot and posting fields the SPA reads', () => {
    const names = fieldNames(PayrollRuns)
    expect(names).toEqual(
      expect.arrayContaining([
        'runNumber',
        'period',
        'payDate',
        'status',
        'lines',
        'grossPay',
        'totalDeductions',
        'netPay',
        'expenseAccount',
        'paymentAccount',
        'journalEntry',
        'tenant',
      ]),
    )
  })

  it('offers draft, posted and void statuses', () => {
    const status = PayrollRuns.fields.find((f) => (f as any).name === 'status') as any
    expect(status.options.map((o: any) => o.value)).toEqual(['draft', 'posted', 'void'])
    expect(status.defaultValue).toBe('draft')
  })

  it('recomputes totals from lines on every write', () => {
    expect(PayrollRuns.hooks?.beforeValidate?.length).toBeGreaterThan(1)
  })
})

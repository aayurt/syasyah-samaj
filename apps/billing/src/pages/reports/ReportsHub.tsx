import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  BookOpenText,
  Boxes,
  Clock3,
  CreditCard,
  FileText,
  Hash,
  IndianRupee,
  LayoutList,
  Package,
  Receipt,
  Scale,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import SearchBox from '../../components/SearchBox'
import DataStatus from '../../components/DataStatus'
import { useT } from '../../lib/i18n'

interface ReportCard {
  title: string
  titleKey: string
  desc: string
  descKey: string
  icon: typeof BarChart3
  to: string
}

const CATEGORIES = [
  'All Reports',
  'Transactions',
  'Parties',
  'Inventory',
  'Income Expense',
  'Business Status',
] as const

type Category = (typeof CATEGORIES)[number]

const REPORTS: Record<Category, ReportCard[]> = {
  'All Reports': [], // computed below
  Transactions: [
    { title: 'Sales', titleKey: 'reports.sales', desc: 'View your sales data with payment tracking', descKey: 'reports.salesDesc', icon: TrendingUp, to: '/reports/sales' },
    { title: 'Purchase', titleKey: 'reports.purchase', desc: 'View your purchase data with payment tracking', descKey: 'reports.purchaseDesc', icon: ShoppingCart, to: '/reports/purchase' },
    { title: 'Day Book', titleKey: 'reports.dayBook', desc: 'View all of your daily transactions', descKey: 'reports.dayBookDesc', icon: BookOpenText, to: '/daybooks' },
    { title: 'Profit And Loss', titleKey: 'reports.profitAndLoss', desc: 'View your profit & loss in a given time', descKey: 'reports.profitAndLossDesc', icon: BarChart3, to: '/reports/pnl' },
  ],
  Parties: [
    { title: 'Party Statement', titleKey: 'reports.partyStatement', desc: 'Check the transactions of a certain party', descKey: 'reports.partyStatementDesc', icon: FileText, to: '/reports/party-statement' },
    { title: 'All Party Report', titleKey: 'reports.allPartyReport', desc: 'Receivable/payable dues of every party', descKey: 'reports.allPartyReportDesc', icon: IndianRupee, to: '/aging' },
  ],
  Inventory: [
    { title: 'Low Stock Summary', titleKey: 'reports.lowStockSummary', desc: 'View all items which are getting low on quantity', descKey: 'reports.lowStockSummaryDesc', icon: TrendingDown, to: '/reports/low-stock' },
    { title: 'Stock Quantity Report', titleKey: 'reports.stockQuantityReport', desc: 'View opening & closing quantity of each item', descKey: 'reports.stockQuantityReportDesc', icon: Hash, to: '/reports/stock-quantity' },
    { title: 'Inventory Valuation', titleKey: 'reports.inventoryValuation', desc: 'Opening, receipts, issues & closing value at AVCO', descKey: 'reports.inventoryValuationDesc', icon: BarChart3, to: '/reports/inventory-valuation' },
  ],
  'Income Expense': [
    { title: 'Income Expense Report', titleKey: 'reports.incomeExpenseReport', desc: 'Check all the income expense report', descKey: 'reports.incomeExpenseReportDesc', icon: BarChart3, to: '/reports/pnl' },
    { title: 'Expense Category', titleKey: 'reports.expenseCategory', desc: 'Check the categorized expense report in a given date', descKey: 'reports.expenseCategoryDesc', icon: TrendingDown, to: '/reports/expense-category' },
    { title: 'Income Category', titleKey: 'reports.incomeCategory', desc: 'Check the categorized income report in a given date', descKey: 'reports.incomeCategoryDesc', icon: TrendingUp, to: '/reports/income-category' },
  ],
  'Business Status': [
    { title: 'Balance Sheet', titleKey: 'reports.balanceSheet', desc: 'Assets, liabilities & equity snapshot', descKey: 'reports.balanceSheetDesc', icon: Scale, to: '/reports/balance-sheet' },
    { title: 'Cash In Hand Statement', titleKey: 'reports.cashInHandStatement', desc: 'Check all transactions made with cash', descKey: 'reports.cashInHandStatementDesc', icon: Wallet, to: '/reports/cash-statement' },
    { title: 'Bank Statement', titleKey: 'reports.bankStatement', desc: 'Check all the transactions made with bank', descKey: 'reports.bankStatementDesc', icon: CreditCard, to: '/reports/bank-statement' },
    { title: 'Tax Sales', titleKey: 'reports.taxSales', desc: 'Check report of all tax applicable sales', descKey: 'reports.taxSalesDesc', icon: Receipt, to: '/reports/tax-sales' },
    { title: 'Tax Purchase', titleKey: 'reports.taxPurchase', desc: 'Check report of all tax applicable purchase', descKey: 'reports.taxPurchaseDesc', icon: Truck, to: '/reports/tax-purchase' },
    { title: 'VAT Registers', titleKey: 'reports.vatRegisters', desc: 'Sales, purchase & return registers for VAT filing', descKey: 'reports.vatRegistersDesc', icon: BookOpenText, to: '/reports/vat-register' },
  ],
}

// All Reports = deduplicated union of all categories
REPORTS['All Reports'] = Array.from(
  new Map(
    Object.entries(REPORTS)
      .filter(([k]) => k !== 'All Reports')
      .flatMap(([, cards]) => cards)
      .map((c) => [c.to, c]),
  ).values(),
)

export default function ReportsHub() {
  const t = useT()
  const [cat, setCat] = useState<Category>('All Reports')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const cards = REPORTS[cat].filter(
    (c) =>
      !query ||
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.desc.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t('reports.hubTitle', 'Browse Various Reports')}</h1>
        <SearchBox value={query} onChange={setQuery} placeholder={t('reports.hubSearchPlaceholder', 'Search reports…')} />
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>

      {/* Category tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              cat === c
                ? 'bg-crimson-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t(`reports.tab${c.replace(/\s+/g, '')}` as any, c)}
          </button>
        ))}
      </div>

      {/* Card grid grouped by category */}
      {cat === 'All Reports' ? (
        Object.entries(REPORTS)
          .filter(([k]) => k !== 'All Reports')
          .map(([category, categoryCards]) => {
            const filtered = categoryCards.filter(
              (c) =>
                !query ||
                c.title.toLowerCase().includes(query.toLowerCase()) ||
                c.desc.toLowerCase().includes(query.toLowerCase()),
            )
            if (filtered.length === 0) return null
            return (
              <div key={category} className="mt-6">
                <h2 className="text-sm font-semibold text-slate-500">{t(('reports.tab' + category.replace(/\s+/g, '')) as any, category)}</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((r) => (
                    <ReportCard key={r.to + r.title} card={r} onClick={() => navigate(r.to)} />
                  ))}
                </div>
              </div>
            )
          })
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((r) => (
            <ReportCard key={r.to + r.title} card={r} onClick={() => navigate(r.to)} />
          ))}
        </div>
      )}

      {cards.length === 0 && query && (
        <p className="mt-8 text-center text-sm text-slate-400">
          {t('reports.noReportsMatch', 'No reports match')} &quot;{query}&quot;
        </p>
      )}
    </div>
  )
}

function ReportCard({ card, onClick }: { card: ReportCard; onClick: () => void }) {
  const t = useT()
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-400 hover:bg-slate-50"
    >
      <card.icon size={18} className="text-slate-400" />
      <div className="text-sm font-medium text-slate-800">{t(card.titleKey as any, card.title)}</div>
      <div className="text-xs text-slate-400">{t(card.descKey as any, card.desc)}</div>
    </button>
  )
}

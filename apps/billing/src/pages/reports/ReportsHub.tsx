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

interface ReportCard {
  title: string
  desc: string
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
    { title: 'Sales', desc: 'View your sales data with payment tracking', icon: TrendingUp, to: '/reports/sales' },
    { title: 'Purchase', desc: 'View your purchase data with payment tracking', icon: ShoppingCart, to: '/reports/purchase' },
    { title: 'Day Book', desc: 'View all of your daily transactions', icon: BookOpenText, to: '/daybooks' },
    { title: 'Profit And Loss', desc: 'View your profit & loss in a given time', icon: BarChart3, to: '/reports/pnl' },
  ],
  Parties: [
    { title: 'Party Statement', desc: 'Check the transactions of a certain party', icon: FileText, to: '/reports/party-statement' },
    { title: 'All Party Report', desc: 'Receivable/payable dues of every party', icon: IndianRupee, to: '/aging' },
  ],
  Inventory: [
    { title: 'Low Stock Summary', desc: 'View all items which are getting low on quantity', icon: TrendingDown, to: '/reports/low-stock' },
    { title: 'Stock Quantity Report', desc: 'View opening & closing quantity of each item', icon: Hash, to: '/reports/stock-quantity' },
  ],
  'Income Expense': [
    { title: 'Income Expense Report', desc: 'Check all the income expense report', icon: BarChart3, to: '/reports/pnl' },
    { title: 'Expense Category', desc: 'Check the categorized expense report in a given date', icon: TrendingDown, to: '/reports/expense-category' },
    { title: 'Income Category', desc: 'Check the categorized income report in a given date', icon: TrendingUp, to: '/reports/income-category' },
  ],
  'Business Status': [
    { title: 'Balance Sheet', desc: 'Assets, liabilities & equity snapshot', icon: Scale, to: '/reports/balance-sheet' },
    { title: 'Cash In Hand Statement', desc: 'Check all transactions made with cash', icon: Wallet, to: '/reports/cash-statement' },
    { title: 'Bank Statement', desc: 'Check all the transactions made with bank', icon: CreditCard, to: '/reports/bank-statement' },
    { title: 'Tax Sales', desc: 'Check report of all tax applicable sales', icon: Receipt, to: '/reports/tax-sales' },
    { title: 'Tax Purchase', desc: 'Check report of all tax applicable purchase', icon: Truck, to: '/reports/tax-purchase' },
    { title: 'VAT Registers', desc: 'Sales, purchase & return registers for VAT filing', icon: BookOpenText, to: '/reports/vat-register' },
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
        <h1 className="text-lg font-semibold text-slate-900">Browse Various Reports</h1>
        <SearchBox value={query} onChange={setQuery} placeholder="Search reports…" />
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
            {c}
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
                <h2 className="text-sm font-semibold text-slate-500">{category} Report</h2>
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
          No reports match "{query}"
        </p>
      )}
    </div>
  )
}

function ReportCard({ card, onClick }: { card: ReportCard; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-400 hover:bg-slate-50"
    >
      <card.icon size={18} className="text-slate-400" />
      <div className="text-sm font-medium text-slate-800">{card.title}</div>
      <div className="text-xs text-slate-400">{card.desc}</div>
    </button>
  )
}

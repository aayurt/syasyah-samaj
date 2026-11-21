import React, { useMemo } from 'react'
import { fmt } from '../lib/api'

export interface BreakdownSegment {
  label: string
  value: number
  color: string // Tailwind bg class e.g. 'bg-emerald-500' or hex/rgb
  sublabel?: string
}

export interface ReportBreakdownBarProps {
  title?: string
  segments: BreakdownSegment[]
  totalLabel?: string
  className?: string
  showZero?: boolean
}

/**
 * Segmented horizontal proportion bar with breakdown cards.
 * Useful for Income vs COGS vs Expenses; Assets vs Liabilities; Output vs Input VAT.
 */
export function ReportBreakdownBar({
  title,
  segments,
  totalLabel,
  className = '',
  showZero = false,
}: ReportBreakdownBarProps) {
  const validSegments = useMemo(
    () => segments.filter((s) => showZero || Math.abs(s.value) > 0),
    [segments, showZero]
  )

  const sum = useMemo(
    () => validSegments.reduce((acc, s) => acc + Math.abs(s.value), 0),
    [validSegments]
  )

  if (sum === 0 && !showZero) {
    return null
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">{title}</h3>
          {totalLabel && (
            <span className="text-xs text-slate-500">
              {totalLabel}: <strong className="font-mono text-slate-800">{fmt(sum)}</strong>
            </span>
          )}
        </div>
      )}

      {/* Segmented bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner">
        {validSegments.map((seg, idx) => {
          const pct = sum > 0 ? (Math.abs(seg.value) / sum) * 100 : 0
          if (pct <= 0) return null
          return (
            <div
              key={seg.label + idx}
              title={`${seg.label}: ${fmt(seg.value)} (${pct.toFixed(1)}%)`}
              className={`h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full ${seg.color}`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? '6px' : '0' }}
            />
          )
        })}
      </div>

      {/* Legend & Details */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {validSegments.map((seg, idx) => {
          const pct = sum > 0 ? (Math.abs(seg.value) / sum) * 100 : 0
          return (
            <div
              key={seg.label + idx}
              className="flex flex-col rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-xs"
            >
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${seg.color}`} />
                <span className="truncate font-medium">{seg.label}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-1 font-mono">
                <span className="font-semibold text-slate-900">{fmt(seg.value)}</span>
                <span className="text-[11px] text-slate-500">{pct.toFixed(1)}%</span>
              </div>
              {seg.sublabel && <span className="mt-0.5 text-[10px] text-slate-400">{seg.sublabel}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface TrendBarItem {
  label: string
  sublabel?: string
  primaryValue: number
  primaryLabel?: string
  secondaryValue?: number
  secondaryLabel?: string
}

export interface ReportTrendChartProps {
  title?: string
  subtitle?: string
  items: TrendBarItem[]
  primaryColor?: string // Tailwind bg class
  secondaryColor?: string
  height?: number
  className?: string
}

/**
 * Modern bar chart for multi-period trends (e.g. Sales, Purchases, Cashflow).
 */
export function ReportTrendChart({
  title,
  subtitle,
  items,
  primaryColor = 'bg-blue-500',
  secondaryColor = 'bg-rose-400',
  height = 160,
  className = '',
}: ReportTrendChartProps) {
  const maxVal = useMemo(() => {
    let m = 1
    for (const it of items) {
      m = Math.max(m, it.primaryValue || 0, it.secondaryValue || 0)
    }
    return m
  }, [items])

  if (!items || items.length === 0) return null

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            {title && <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {items[0]?.primaryLabel && (
              <span className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-sm ${primaryColor}`} />
                {items[0].primaryLabel}
              </span>
            )}
            {items[0]?.secondaryLabel && (
              <span className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-sm ${secondaryColor}`} />
                {items[0].secondaryLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chart bars */}
      <div className="flex items-end gap-2 overflow-x-auto pt-4" style={{ height }}>
        {items.map((item, idx) => {
          const primH = maxVal > 0 ? (Math.max(0, item.primaryValue) / maxVal) * 100 : 0
          const secH = maxVal > 0 && item.secondaryValue ? (Math.max(0, item.secondaryValue) / maxVal) * 100 : 0

          return (
            <div
              key={item.label + idx}
              className="group relative flex flex-1 flex-col items-center justify-end h-full min-w-[36px]"
            >
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[10px] text-white shadow-md group-hover:block">
                <div>{item.label}</div>
                <div>
                  {item.primaryLabel || 'Value'}: {fmt(item.primaryValue)}
                </div>
                {item.secondaryValue !== undefined && (
                  <div>
                    {item.secondaryLabel || 'Secondary'}: {fmt(item.secondaryValue)}
                  </div>
                )}
              </div>

              {/* Bar columns */}
              <div className="flex w-full items-end justify-center gap-1">
                <div
                  className={`w-3.5 sm:w-5 rounded-t-sm transition-all duration-300 ${primaryColor}`}
                  style={{ height: `${primH}%`, minHeight: primH > 0 ? 3 : 0 }}
                />
                {item.secondaryValue !== undefined && (
                  <div
                    className={`w-3.5 sm:w-5 rounded-t-sm transition-all duration-300 ${secondaryColor}`}
                    style={{ height: `${secH}%`, minHeight: secH > 0 ? 3 : 0 }}
                  />
                )}
              </div>

              {/* Label */}
              <div className="mt-2 text-center">
                <div className="truncate text-[10px] font-medium text-slate-600 max-w-[48px]">{item.label}</div>
                {item.sublabel && <div className="text-[9px] text-slate-400">{item.sublabel}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface MetricGaugeProps {
  label: string
  value: string | number
  percentage?: number
  statusColor?: string // text-emerald-700, text-blue-700, etc.
  barColor?: string // bg-emerald-500
  description?: string
  className?: string
}

/**
 * Metric card with a progress/ratio indicator.
 */
export function ReportMetricGauge({
  label,
  value,
  percentage,
  statusColor = 'text-slate-900',
  barColor = 'bg-blue-500',
  description,
  className = '',
}: MetricGaugeProps) {
  const clampedPct = percentage !== undefined ? Math.max(0, Math.min(100, percentage)) : undefined

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className={`font-mono text-2xl font-bold tracking-tight ${statusColor}`}>
          {typeof value === 'number' ? fmt(value) : value}
        </span>
        {clampedPct !== undefined && (
          <span className="font-mono text-xs font-semibold text-slate-600">{clampedPct.toFixed(1)}%</span>
        )}
      </div>

      {clampedPct !== undefined && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${clampedPct}%` }}
          />
        </div>
      )}

      {description && <p className="mt-2 text-xs text-slate-400">{description}</p>}
    </div>
  )
}

import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Circle, Sparkles } from 'lucide-react'
import { SETUP_STEPS, useSetupStatus, type SetupStatus } from '../lib/setup'

type SetupStepKey = 'company' | 'fiscalYear' | 'chart' | 'defaults'

/**
 * M1 setup gate — the Dashboard onboarding card. Shows the four setup steps
 * (company → fiscal year → chart of accounts → default accounts) and ticks
 * them off as each is completed. Hidden entirely once setup is complete.
 * Voucher posting is disabled until `complete` (see the voucher forms).
 */
export default function SetupChecklist() {
  const setup = useSetupStatus()
  if (setup.loading || setup.complete) return null

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-crimson-200 bg-gradient-to-br from-crimson-50/60 to-white">
      <div className="border-b border-crimson-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-crimson-600" />
          <h2 className="text-sm font-semibold text-slate-800">Set up your books</h2>
          <span className="ml-auto rounded-full bg-crimson-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            {setup.missingCount} step{setup.missingCount === 1 ? '' : 's'} left
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Posting stays disabled until all four are done — you can still save drafts.
        </p>
      </div>
      <ol className="divide-y divide-slate-100">
        {SETUP_STEPS.map((step) => {
          const done = setup[step.key as SetupStepKey]
          return (
            <li key={step.key}>
              <Link
                to={step.to}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  done
                    ? 'text-slate-400'
                    : 'text-slate-700 hover:bg-crimson-50/60'
                }`}
              >
                {done ? (
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                ) : (
                  <Circle size={18} className="shrink-0 text-slate-300" />
                )}
                <span className={done ? 'line-through decoration-slate-300' : ''}>
                  {step.label}
                </span>
                {!done && <ChevronRight size={14} className="ml-auto text-slate-300" />}
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export type { SetupStatus }
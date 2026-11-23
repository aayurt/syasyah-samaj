import React from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import type { StepDef } from '../types'
import { useT } from '../../../lib/i18n'

interface SetupRailProps {
  requiredSteps: StepDef[]
  optionalSteps: StepDef[]
  satisfied: Record<string, boolean>
  stepIdx: number
  busy: string
  onSelectStep: (idx: number) => void
}

export const SetupRail: React.FC<SetupRailProps> = ({
  requiredSteps,
  optionalSteps,
  satisfied,
  stepIdx,
  busy,
  onSelectStep,
}) => {
  const t = useT()

  return (
    <div className="mb-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-800">
          {t('setup.title', 'Get the books ready')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete the required steps below before you start posting.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 px-2">
        {/* Required Steps */}
        {requiredSteps.map((s, i) => {
          const done = Boolean(satisfied[s.key])
          const active = i === stepIdx
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => !busy && onSelectStep(i)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-crimson-500 bg-crimson-50 text-crimson-700 font-semibold shadow-2xs'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {done ? (
                <CheckCircle2 size={13} className="text-emerald-600" />
              ) : (
                <Circle size={13} className={active ? 'text-crimson-600' : 'text-slate-400'} />
              )}
              <span>{s.title}</span>
            </button>
          )
        })}

        {/* Optional Steps */}
        {optionalSteps.map((s, i) => {
          const done = Boolean(satisfied[s.key])
          const active = requiredSteps.length + i === stepIdx
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => !busy && onSelectStep(requiredSteps.length + i)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-slate-500 bg-slate-50 text-slate-700 font-semibold shadow-2xs'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              {done ? (
                <CheckCircle2 size={13} className="text-emerald-600" />
              ) : (
                <Circle size={13} className="text-slate-300" />
              )}
              <span>{s.title} (optional)</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * PipelineStageTracker — Horizontal arrow-based KYC stage progress indicator
 *
 * Each stage has 5 states:
 *   idle     → dim, waiting
 *   active   → sky-blue pulsing ring, animated spinner
 *   success  → solid green, checkmark, faint glow
 *   warning  → amber, warning icon
 *   failed   → red, X icon, brief shake on transition
 *
 * Connecting arrows fill with color as the stage to their left completes.
 */

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-5 h-5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" className="animate-check" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 animate-spin">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function StageIcon({ type }) {
  const icons = {
    document: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    ocr: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <circle cx="12" cy="13" r="3" strokeWidth={1.8} />
      </svg>
    ),
    compliance: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    face: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    decision: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  }
  return icons[type] || icons.document
}

/**
 * @param {Array} stages - array of { id, label, icon, status, message }
 *   status: 'idle' | 'active' | 'success' | 'warning' | 'failed'
 */
export default function PipelineStageTracker({ stages }) {
  return (
    <div className="w-full">
      {/* Stage circles + connectors */}
      <div className="flex items-center w-full">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1
          const prevStage = idx > 0 ? stages[idx - 1] : null
          const connectorFilled = prevStage && (prevStage.status === 'success' || prevStage.status === 'warning' || prevStage.status === 'failed')

          return (
            <div key={stage.id} className="flex items-center flex-1 last:flex-none">
              {/* Connector arrow (before every stage except first) */}
              {idx > 0 && (
                <div className="flex-1 flex items-center mx-1">
                  <div className="flex-1 h-0.5 bg-slate-800 relative overflow-hidden">
                    {connectorFilled && (
                      <div
                        className={`absolute inset-y-0 left-0 connector-fill ${
                          prevStage.status === 'success' ? 'bg-emerald-500' :
                          prevStage.status === 'warning' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                      />
                    )}
                  </div>
                  {/* Arrow head */}
                  <svg width="10" height="10" viewBox="0 0 10 10" className={`flex-shrink-0 -ml-0.5 ${connectorFilled ?
                    (prevStage.status === 'success' ? 'text-emerald-500' : prevStage.status === 'warning' ? 'text-amber-500' : 'text-red-500')
                    : 'text-slate-700'}`}>
                    <path d="M0 2L6 5L0 8Z" fill="currentColor" />
                  </svg>
                </div>
              )}

              {/* Stage circle */}
              <div className="flex flex-col items-center gap-2">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 relative flex-shrink-0
                  ${stage.status === 'idle'    ? 'bg-slate-900 border-slate-700 text-slate-600' : ''}
                  ${stage.status === 'active'  ? 'bg-slate-900 border-sky-500 text-sky-400 stage-active-ring' : ''}
                  ${stage.status === 'success' ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.35)]' : ''}
                  ${stage.status === 'warning' ? 'bg-amber-950/60 border-amber-500 text-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.35)]' : ''}
                  ${stage.status === 'failed'  ? 'bg-red-950/50 border-red-500 text-red-400 shadow-[0_0_14px_rgba(239,68,68,0.35)] stage-error-shake' : ''}
                `}>
                  {stage.status === 'active'  && <SpinnerIcon />}
                  {stage.status === 'success' && <CheckIcon />}
                  {stage.status === 'warning' && <WarningIcon />}
                  {stage.status === 'failed'  && <XIcon />}
                  {stage.status === 'idle'    && <StageIcon type={stage.icon} />}
                </div>

                {/* Label */}
                <div className="text-center flex flex-col items-center gap-0.5">
                  <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors duration-300 ${
                    stage.status === 'idle'    ? 'text-slate-600' :
                    stage.status === 'active'  ? 'text-sky-400' :
                    stage.status === 'success' ? 'text-emerald-400' :
                    stage.status === 'warning' ? 'text-amber-400' :
                    'text-red-400'
                  }`}>{stage.label}</span>
                  {stage.message && stage.status !== 'idle' && (
                    <span className={`text-[10px] font-mono max-w-[100px] text-center leading-tight transition-colors ${
                      stage.status === 'active'  ? 'text-sky-500/80 animate-pulse' :
                      stage.status === 'success' ? 'text-emerald-600' :
                      stage.status === 'warning' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>{stage.message}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

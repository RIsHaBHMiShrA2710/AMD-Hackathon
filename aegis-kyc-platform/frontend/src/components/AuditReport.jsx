function DecisionBadge({ decision }) {
  const config = {
    APPROVE:  { cls: 'decision-approve',  label: 'APPROVED',   desc: 'Identity verified — no issues detected' },
    REVIEW:   { cls: 'decision-review',   label: 'MANUAL REVIEW',     desc: 'Manual compliance review required' },
    ESCALATE: { cls: 'decision-escalate', label: 'ESCALATED',  desc: 'High-risk case — immediate escalation' },
    PENDING:  { cls: 'bg-slate-800',      label: 'PENDING',    desc: 'Processing case...' },
  }
  const { cls, label, desc } = config[decision] || config.PENDING

  return (
    <div className={`${cls} rounded-lg p-5 text-center text-white mb-6 border`}>
      <div className="text-2xl font-bold tracking-wider mb-1">{label}</div>
      <div className="text-xs opacity-90">{desc}</div>
    </div>
  )
}

function DataField({ label, value, sensitive = false }) {
  if (!value || value === 'UNKNOWN') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">{label}</span>
      <span className={`text-sm font-medium ${sensitive ? 'text-amber-400 font-mono' : 'text-slate-200'}`}>
        {value}
      </span>
    </div>
  )
}

function ComplianceFlag({ flag }) {
  const isRegistry = flag.watchlist_id === 'GOV-REGISTRY';
  return (
    <div className={`p-3 rounded-lg border ${
      isRegistry 
        ? 'bg-slate-900 border-amber-800/60' 
        : 'bg-slate-900 border-red-800/60'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs font-semibold ${isRegistry ? 'text-amber-450' : 'text-red-400'}`}>
          {isRegistry ? 'National Registry Alert' : `Watchlist Match: ${flag.matched_name}`}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
          flag.risk_tier === 'HIGH' ? 'bg-red-950/60 text-red-400 border border-red-900/40' : 'bg-amber-955/60 text-amber-400 border border-amber-900/40'
        }`}>
          {flag.risk_tier}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono">
        <div><span className="text-slate-500">Score: </span><span>{flag.score}%</span></div>
        <div><span className="text-slate-500">Source: </span>{isRegistry ? 'Gov Registry DB' : 'Sanctions List'}</div>
        <div><span className="text-slate-500">Record ID: </span><span>{flag.watchlist_id}</span></div>
        <div><span className="text-slate-500">Submitted: </span>{flag.submitted_name}</div>
      </div>
      {flag.reason && (
        <p className="mt-2 text-xs text-slate-400 font-sans border-t border-slate-800/60 pt-2">{flag.reason}</p>
      )}
    </div>
  )
}

export default function AuditReport({ finalState, isStreaming }) {
  if (!finalState && !isStreaming) {
    return (
      <div className="glass rounded-lg p-8 flex flex-col items-center justify-center text-center h-full min-h-64">
        <h2 className="text-sm font-semibold text-slate-400">Compliance Audit Report</h2>
        <p className="text-xs text-slate-650 mt-2">The compliance report will be rendered here after the agent pipeline executes</p>
      </div>
    )
  }

  if (isStreaming && !finalState) {
    return (
      <div className="glass rounded-lg p-8 flex flex-col items-center justify-center text-center h-full min-h-64">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-550 animate-spin mb-4" />
        <h2 className="text-sm font-semibold text-slate-400">Orchestrator Running...</h2>
        <p className="text-xs text-slate-550 mt-2">Awaiting decision outcome</p>
      </div>
    )
  }

  if (!finalState) return null

  const {
    final_decision,
    confidence_score,
    extracted_data = {},
    compliance_flags = [],
    audit_summary,
    security_status,
    agent_logs = [],
  } = finalState

  return (
    <div className="glass rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-white">Compliance Audit Report</h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">Case Decided</p>
        </div>
      </div>

      {/* Decision Hero */}
      <DecisionBadge decision={final_decision} />

      {/* Confidence Meter */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-mono">
          <span>Watchlist Confidence Score</span>
          <span className={`font-bold ${
            confidence_score > 0.85 ? 'text-red-400' :
            confidence_score > 0.5  ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {(confidence_score * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 rounded bg-slate-900 overflow-hidden">
          <div
            className={`h-full rounded transition-all duration-1000 ${
              confidence_score > 0.85 ? 'bg-red-500' :
              confidence_score > 0.5  ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${Math.min(confidence_score * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
          <span>0% (Clear)</span>
          <span>85% (Review)</span>
          <span>95% (Escalate)</span>
        </div>
      </div>

      {/* Two-column data grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
        {/* Extracted Identity */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-950 border border-slate-800">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800 pb-1.5">
            Extracted Identity
          </h3>
          <DataField label="Full Name"       value={extracted_data.full_name} />
          <DataField label="Date of Birth"   value={extracted_data.date_of_birth} />
          <DataField label="Nationality"     value={extracted_data.nationality} />
          <DataField label="Document Type"   value={extracted_data.document_type} />
          <DataField label="Document Number" value={extracted_data.document_number} sensitive />
        </div>

        {/* Case Metadata */}
        <div className="space-y-3 p-4 rounded-lg bg-slate-950 border border-slate-800">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800 pb-1.5">
            Case Metadata
          </h3>
          <DataField label="Security Status"   value={security_status} />
          <DataField label="Flags Detected"    value={`${compliance_flags.length} flag(s)`} />
          <DataField label="Decision"          value={final_decision} />
          <DataField label="Confidence"        value={`${(confidence_score * 100).toFixed(2)}%`} />
          {finalState.input_type === 'image' && (
            <>
              <DataField label="OCR Language"   value={finalState.ocr_language_detected} />
              <DataField label="Bilingual Match" value={finalState.ocr_bilingual_match_status} />
            </>
          )}
        </div>
      </div>

      {/* Compliance Flags */}
      {compliance_flags.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] font-semibold text-red-400 uppercase tracking-wider font-mono mb-3">
            Watchlist Matches ({compliance_flags.length})
          </h3>
          <div className="space-y-2">
            {compliance_flags.map((flag, i) => (
              <ComplianceFlag key={i} flag={flag} />
            ))}
          </div>
        </div>
      )}

      {/* Audit Summary */}
      {audit_summary && (
        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono mb-2">
            Audit Summary
          </h3>
          <p className="text-xs text-slate-350 leading-relaxed font-sans">{audit_summary}</p>
        </div>
      )}

      {/* Agent Logs Accordion */}
      {agent_logs.length > 0 && (
        <details className="mt-4 group border-t border-slate-800 pt-3">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-350 transition-colors select-none flex items-center gap-1 font-mono">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
            </svg>
            Agent execution logs ({agent_logs.length} entries)
          </summary>
          <div className="mt-2 max-h-40 overflow-y-auto rounded bg-slate-950 p-3 space-y-1 border border-slate-800">
            {agent_logs.map((log, i) => (
              <div key={i} className="text-[11px] font-mono text-slate-500 leading-relaxed">{log}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

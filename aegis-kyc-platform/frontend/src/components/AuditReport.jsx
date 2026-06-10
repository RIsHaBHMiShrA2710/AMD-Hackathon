/**
 * AuditReport — Final KYC compliance report
 * 
 * Renders the complete KYC case result once the pipeline stream completes.
 * Uses high-contrast colour coding:
 *   Green  → APPROVE
 *   Amber  → REVIEW  
 *   Red    → ESCALATE
 * 
 * Layout: two-column grid with decision hero at top,
 * extracted data on left, compliance flags on right.
 */

function DecisionBadge({ decision }) {
  const config = {
    APPROVE:  { cls: 'decision-approve',  label: '✅ APPROVED',   desc: 'Identity verified — no issues detected' },
    REVIEW:   { cls: 'decision-review',   label: '🟡 REVIEW',     desc: 'Manual review required' },
    ESCALATE: { cls: 'decision-escalate', label: '🔴 ESCALATED',  desc: 'High-risk case — immediate escalation' },
    PENDING:  { cls: 'bg-slate-700',      label: '⏳ PENDING',    desc: 'Processing...' },
  }
  const { cls, label, desc } = config[decision] || config.PENDING

  return (
    <div className={`${cls} rounded-2xl p-6 text-center text-white mb-6 animate-slide-up`}>
      <div className="text-4xl font-black tracking-widest mb-1">{label}</div>
      <div className="text-sm opacity-80">{desc}</div>
    </div>
  )
}

function DataField({ label, value, sensitive = false }) {
  if (!value || value === 'UNKNOWN') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-medium ${sensitive ? 'text-amber-300 font-mono' : 'text-slate-200'}`}>
        {value}
      </span>
    </div>
  )
}

function ComplianceFlag({ flag }) {
  return (
    <div className="p-3 rounded-xl bg-red-950/50 border border-red-700/40 animate-fade-in">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-red-300">⚠️ {flag.matched_name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
          flag.risk_tier === 'HIGH' ? 'bg-red-900 text-red-200' : 'bg-amber-900 text-amber-200'
        }`}>
          {flag.risk_tier}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
        <div><span className="text-slate-500">Match: </span><span className="text-amber-300 font-mono font-bold">{flag.score}%</span></div>
        <div><span className="text-slate-500">Country: </span>{flag.country}</div>
        <div><span className="text-slate-500">List ID: </span><span className="font-mono">{flag.watchlist_id}</span></div>
        <div><span className="text-slate-500">Submitted: </span>{flag.submitted_name}</div>
      </div>
      {flag.reason && (
        <p className="mt-2 text-xs text-slate-500 italic border-t border-red-800/40 pt-2">{flag.reason}</p>
      )}
    </div>
  )
}

export default function AuditReport({ finalState, isStreaming }) {
  if (!finalState && !isStreaming) {
    return (
      <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-64 animate-fade-in">
        <div className="text-5xl mb-4 opacity-20">📊</div>
        <h2 className="text-lg font-semibold text-slate-400">Audit Report</h2>
        <p className="text-sm text-slate-600 mt-2">The compliance report will appear here after analysis completes</p>
      </div>
    )
  }

  if (isStreaming && !finalState) {
    return (
      <div className="glass rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-64 animate-fade-in">
        <div className="w-12 h-12 rounded-full border-4 border-aegis-700 border-t-aegis-400 animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-aegis-300">Agents Running...</h2>
        <p className="text-sm text-slate-500 mt-2">Awaiting pipeline completion</p>
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
    <div className="glass rounded-2xl p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Compliance Audit Report</h2>
          <p className="text-xs text-slate-400 mt-0.5">AI-generated compliance decision</p>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {new Date().toLocaleString()}
        </span>
      </div>

      {/* Decision Hero */}
      <DecisionBadge decision={final_decision} />

      {/* Confidence Meter */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Watchlist Confidence Score</span>
          <span className={`font-bold font-mono ${
            confidence_score > 0.85 ? 'text-red-400' :
            confidence_score > 0.5  ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {(confidence_score * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              confidence_score > 0.85 ? 'bg-gradient-to-r from-red-600 to-red-400' :
              confidence_score > 0.5  ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                                        'bg-gradient-to-r from-emerald-700 to-emerald-400'
            }`}
            style={{ width: `${Math.min(confidence_score * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-700 mt-1">
          <span>0% — Clear</span>
          <span>85% — Review</span>
          <span>95% — Auto-Escalate</span>
        </div>
      </div>

      {/* Two-column data grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
        {/* Extracted Identity */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            🪪 Extracted Identity
          </h3>
          <DataField label="Full Name"       value={extracted_data.full_name} />
          <DataField label="Date of Birth"   value={extracted_data.date_of_birth} />
          <DataField label="Nationality"     value={extracted_data.nationality} />
          <DataField label="Document Type"   value={extracted_data.document_type} />
          <DataField label="Document Number" value={extracted_data.document_number} sensitive />
        </div>

        {/* Case Metadata */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            📋 Case Metadata
          </h3>
          <DataField label="Security Status"   value={security_status} />
          <DataField label="Flags Detected"    value={`${compliance_flags.length} flag(s)`} />
          <DataField label="Decision"          value={final_decision} />
          <DataField label="Confidence"        value={`${(confidence_score * 100).toFixed(2)}%`} />
        </div>
      </div>

      {/* Compliance Flags */}
      {compliance_flags.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
            🚨 Watchlist Matches ({compliance_flags.length})
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
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            📝 AI Audit Summary
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">{audit_summary}</p>
        </div>
      )}

      {/* Agent Logs Accordion */}
      {agent_logs.length > 0 && (
        <details className="mt-4 group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none flex items-center gap-1">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
            </svg>
            Agent execution logs ({agent_logs.length} entries)
          </summary>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-black/40 p-3 space-y-1">
            {agent_logs.map((log, i) => (
              <div key={i} className="text-xs font-mono text-slate-400 leading-relaxed">{log}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

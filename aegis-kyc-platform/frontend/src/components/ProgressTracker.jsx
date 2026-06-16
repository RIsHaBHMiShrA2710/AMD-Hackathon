import { useEffect, useRef } from 'react'

const PIPELINE_NODES = [
  { id: 'guardrail',    label: 'Security Guardrail',  icon: 'Shield',      color: 'slate' },
  { id: 'ocr',          label: 'Multi-Language OCR',  icon: 'Camera',      color: 'slate' },
  { id: 'extraction',   label: 'Entity Extraction',   icon: 'Search',      color: 'slate' },
  { id: 'compliance',   label: 'Compliance Screening', icon: 'Scale',      color: 'slate' },
  { id: 'orchestrator', label: 'Decision Logic',      icon: 'Cpu',        color: 'slate' },
  { id: 'sanitizer',    label: 'PII Sanitization',    icon: 'Lock',        color: 'slate' },
]

const COLOR_CLASSES = {
  slate: { bg: 'bg-slate-900', border: 'border-slate-800', active: 'border-indigo-500', dot: 'bg-indigo-500', text: 'text-slate-200' }
}

function getNodeState(nodeId, events) {
  const nodeEvents = events.filter(e => e.node === nodeId)
  if (nodeEvents.length === 0) return { status: 'waiting', messages: [], data: null }

  const lastEvent = nodeEvents[nodeEvents.length - 1]
  let status = 'active'

  if (lastEvent.type === 'node_complete') status = 'complete'
  else if (lastEvent.type === 'node_error') status = 'error'
  else if (lastEvent.type === 'node_start' || lastEvent.type === 'node_progress') status = 'active'

  return {
    status,
    messages: nodeEvents.map(e => e.message).filter(Boolean),
    data: lastEvent.data || null,
    latestMessage: lastEvent.message,
  }
}

function NodeIcon({ type, className }) {
  switch (type) {
    case 'Shield':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
    case 'Camera':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="4"/></svg>
    case 'Search':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
    case 'Scale':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>
    case 'Cpu':
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-3v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg>
    case 'Lock':
    default:
      return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
  }
}

function NodeCard({ node, events }) {
  const { status, data, latestMessage } = getNodeState(node.id, events)
  const colors = COLOR_CLASSES[node.color]

  return (
    <div className={`rounded-lg border transition-colors duration-200 overflow-hidden ${
      status === 'waiting'
        ? 'bg-slate-900/50 border-slate-800/80 opacity-55'
        : status === 'active'
          ? `${colors.bg} ${colors.active} border`
          : status === 'complete'
            ? `${colors.bg} border-slate-800`
            : 'bg-red-950/20 border-red-900'
    }`}>
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Status indicator */}
        <div className="flex-shrink-0 mt-0.5">
          {status === 'waiting' && (
            <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
          )}
          {status === 'active' && (
            <div className={`w-5 h-5 rounded-full ${colors.dot} flex items-center justify-center`}>
              <svg className="w-3.5 h-3.5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          )}
          {status === 'complete' && (
            <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          )}
          {status === 'error' && (
            <div className="w-5 h-5 rounded-full bg-red-650 flex items-center justify-center text-white text-xs font-bold">!</div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <NodeIcon type={node.icon} className={`w-4 h-4 ${status === 'waiting' ? 'text-slate-650' : 'text-slate-400'}`} />
            <span className={`text-xs font-semibold ${status === 'waiting' ? 'text-slate-500' : colors.text}`}>
              {node.label}
            </span>
            {status === 'active' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                Running
              </span>
            )}
          </div>

          {/* Latest message */}
          {latestMessage && status !== 'waiting' && (
            <p className={`text-xs mt-1.5 leading-relaxed font-sans ${
              status === 'active' ? 'text-slate-200' : 'text-slate-400'
            }`}>
              {latestMessage}
            </p>
          )}

          {/* Extracted data preview */}
          {status === 'complete' && data && Object.keys(data).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.extracted_name && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Name: {data.extracted_name}
                </span>
              )}
              {data.flags_count !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  data.flags_count > 0 ? 'bg-red-950/40 text-red-400 border border-red-900/40' : 'bg-slate-800 text-emerald-400'
                }`}>
                  {data.flags_count > 0 ? `Flags: ${data.flags_count}` : 'No flags'}
                </span>
              )}
              {data.confidence_score !== undefined && data.confidence_score > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                  Conf: {(data.confidence_score * 100).toFixed(0)}%
                </span>
              )}
              {data.decision && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold font-mono ${
                  data.decision === 'APPROVE' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' :
                  data.decision === 'REVIEW'  ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40' :
                                                'bg-red-950/40 text-red-400 border border-red-900/40'
                }`}>
                  {data.decision}
                </span>
              )}
              {data.masked_fields?.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  Masked: {data.masked_fields.length}
                </span>
              )}
              {data.security_status && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  data.security_status === 'OK' ? 'bg-slate-800 text-emerald-400' : 'bg-red-950/40 text-red-450'
                }`}>
                  Shield: {data.security_status}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProgressTracker({ events, isStreaming, caseId, onOpenModal }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const hasEvents = events.length > 0
  const isPipelineComplete = events.some(e => e.type === 'pipeline_complete')
  const isPipelineError = events.some(e => e.type === 'pipeline_error')

  return (
    <div className="glass rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            Live Pipeline Monitor
            {events.length > 0 && (
              <button
                id="open-visualizer-btn"
                onClick={onOpenModal}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors font-sans"
              >
                Open Visualizer
              </button>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time agent execution trace</p>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              RUNNING
            </span>
          )}
          {isPipelineComplete && !isStreaming && (
            <span className="text-xs text-emerald-400 font-mono px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
              COMPLETE
            </span>
          )}
          {isPipelineError && (
            <span className="text-xs text-red-405 font-mono px-2 py-0.5 bg-slate-850 rounded border border-slate-750">
              ERROR
            </span>
          )}
        </div>
      </div>

      {/* Case ID Badge */}
      {caseId && caseId !== 'initializing' && (
        <div className="mb-4 px-3 py-1.5 bg-slate-900 rounded border border-slate-800">
          <span className="text-xs text-slate-500 font-mono">Case ID: </span>
          <span className="text-xs text-indigo-400 font-mono">{caseId}</span>
        </div>
      )}

      {/* Empty State */}
      {!hasEvents && !isStreaming && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-slate-500">Submit a document to trigger the orchestration machine</p>
          <p className="text-xs text-slate-650 mt-1">Each validation agent will execute in a sequential dependency graph</p>
        </div>
      )}

      {/* Pipeline Nodes */}
      {(hasEvents || isStreaming) && (
        <div className="space-y-3">
          {PIPELINE_NODES.map((node, idx) => (
            <div key={node.id}>
              <NodeCard
                node={node}
                events={events}
              />
              {idx < PIPELINE_NODES.length - 1 && (
                <div className="flex justify-center my-1.5">
                  <div className={`pipeline-connector h-4 rounded ${
                    getNodeState(node.id, events).status === 'complete' ? 'active' : ''
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raw Log Stream */}
      {events.length > 0 && (
        <details className="mt-5 group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none flex items-center gap-1 font-mono">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
            </svg>
            Raw event log ({events.length} events)
          </summary>
          <div ref={scrollRef} className="mt-2 max-h-48 overflow-y-auto rounded bg-slate-900/60 p-3 font-mono text-xs text-slate-400 space-y-1 border border-slate-800">
            {events.map((event, i) => (
              <div key={i} className="leading-relaxed opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-slate-600">[{event.timestamp?.slice(11, 19) || '??:??:??'}]</span>{' '}
                <span className={
                  event.type === 'node_complete' ? 'text-emerald-400' :
                  event.type === 'node_error'    ? 'text-red-400' :
                  event.type === 'node_start'    ? 'text-indigo-400' :
                  'text-slate-350'
                }>
                  {event.type}
                </span>{' '}
                {event.node && <span className="text-amber-500">[{event.node}]</span>}{' '}
                {event.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

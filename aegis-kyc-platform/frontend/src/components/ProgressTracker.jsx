import { useEffect, useRef } from 'react'

/**
 * ProgressTracker — Live pipeline visualization
 * 
 * Renders real-time events from the backend NDJSON stream as an animated
 * step-by-step pipeline view. Each agent node gets its own card that
 * transitions through: waiting → active (spinning) → complete/error.
 * 
 * This is the key "show what's happening in the backend" component —
 * judges can watch each AI agent fire in sequence.
 */

// Pipeline node metadata (display order and icons)
const PIPELINE_NODES = [
  { id: 'guardrail',    label: 'Security Shield',     icon: '🛡️', color: 'purple' },
  { id: 'extraction',   label: 'LLM Field Extractor',  icon: '🔍', color: 'blue'   },
  { id: 'compliance',   label: 'Watchlist Screener',   icon: '⚖️', color: 'amber'  },
  { id: 'orchestrator', label: 'Decision Reasoner',    icon: '🧠', color: 'green'  },
  { id: 'sanitizer',    label: 'PII Sanitizer',        icon: '🔒', color: 'rose'   },
]

const COLOR_CLASSES = {
  purple: { bg: 'bg-purple-900/30', border: 'border-purple-500/40', active: 'border-purple-400', dot: 'bg-purple-400', text: 'text-purple-300' },
  blue:   { bg: 'bg-blue-900/30',   border: 'border-blue-500/40',   active: 'border-blue-400',   dot: 'bg-blue-400',   text: 'text-blue-300'   },
  amber:  { bg: 'bg-amber-900/30',  border: 'border-amber-500/40',  active: 'border-amber-400',  dot: 'bg-amber-400',  text: 'text-amber-300'  },
  green:  { bg: 'bg-emerald-900/30',border: 'border-emerald-500/40',active: 'border-emerald-400',dot: 'bg-emerald-400',text: 'text-emerald-300'},
  rose:   { bg: 'bg-rose-900/30',   border: 'border-rose-500/40',   active: 'border-rose-400',   dot: 'bg-rose-400',   text: 'text-rose-300'   },
}

function getNodeState(nodeId, events) {
  // Find the latest event for this node
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

function NodeCard({ node, events, isLastActive }) {
  const { status, messages, data, latestMessage } = getNodeState(node.id, events)
  const colors = COLOR_CLASSES[node.color]

  return (
    <div className={`rounded-xl border transition-all duration-500 overflow-hidden ${
      status === 'waiting'
        ? 'bg-slate-900/40 border-slate-800 opacity-50'
        : status === 'active'
          ? `${colors.bg} ${colors.active} border shadow-lg`
          : status === 'complete'
            ? `${colors.bg} border-slate-700`
            : 'bg-red-900/20 border-red-700/40'
    }`}>
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {status === 'waiting' && (
            <div className="w-6 h-6 rounded-full border-2 border-slate-700 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-700" />
            </div>
          )}
          {status === 'active' && (
            <div className={`w-6 h-6 rounded-full ${colors.dot} flex items-center justify-center animate-pulse`}>
              <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          )}
          {status === 'complete' && (
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          )}
          {status === 'error' && (
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">!</div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{node.icon}</span>
            <span className={`text-sm font-semibold ${status === 'waiting' ? 'text-slate-500' : colors.text}`}>
              {node.label}
            </span>
            {status === 'active' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-aegis-900/50 text-aegis-300 border border-aegis-700/30 animate-pulse">
                Running
              </span>
            )}
          </div>

          {/* Latest message */}
          {latestMessage && status !== 'waiting' && (
            <p className={`text-xs mt-1.5 leading-relaxed ${
              status === 'active' ? 'text-slate-200 typing-cursor' : 'text-slate-400'
            }`}>
              {latestMessage}
            </p>
          )}

          {/* Extracted data preview on complete */}
          {status === 'complete' && data && Object.keys(data).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.extracted_name && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  👤 {data.extracted_name}
                </span>
              )}
              {data.flags_count !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  data.flags_count > 0 ? 'bg-red-900/50 text-red-300' : 'bg-emerald-900/50 text-emerald-300'
                }`}>
                  {data.flags_count > 0 ? `🚨 ${data.flags_count} flag(s)` : '✅ No flags'}
                </span>
              )}
              {data.confidence_score !== undefined && data.confidence_score > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 font-mono">
                  {(data.confidence_score * 100).toFixed(1)}% match
                </span>
              )}
              {data.decision && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  data.decision === 'APPROVE' ? 'bg-emerald-900/50 text-emerald-300' :
                  data.decision === 'REVIEW'  ? 'bg-amber-900/50 text-amber-300' :
                                                'bg-red-900/50 text-red-300'
                }`}>
                  {data.decision}
                </span>
              )}
              {data.masked_fields?.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  🔒 {data.masked_fields.length} field(s) masked
                </span>
              )}
              {data.security_status && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  data.security_status === 'OK' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
                }`}>
                  {data.security_status === 'OK' ? '✅ CLEAR' : '🚫 BLOCKED'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProgressTracker({ events, isStreaming, caseId }) {
  const scrollRef = useRef(null)

  // Auto-scroll to bottom as new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  const hasEvents = events.length > 0
  const isPipelineComplete = events.some(e => e.type === 'pipeline_complete')
  const isPipelineError = events.some(e => e.type === 'pipeline_error')

  // Find the currently active node for highlighting the connector
  const activeNodeId = PIPELINE_NODES.find(n => {
    const s = getNodeState(n.id, events)
    return s.status === 'active'
  })?.id

  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Live Pipeline Monitor</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time agent execution trace</p>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-aegis-300 font-mono px-2.5 py-1 bg-aegis-900/40 rounded-full border border-aegis-700/30">
              <span className="w-1.5 h-1.5 rounded-full bg-aegis-400 animate-pulse" />
              LIVE
            </span>
          )}
          {isPipelineComplete && !isStreaming && (
            <span className="text-xs text-emerald-300 font-mono px-2.5 py-1 bg-emerald-900/30 rounded-full border border-emerald-700/30">
              ✅ COMPLETE
            </span>
          )}
          {isPipelineError && (
            <span className="text-xs text-red-300 font-mono px-2.5 py-1 bg-red-900/30 rounded-full border border-red-700/30">
              ❌ ERROR
            </span>
          )}
        </div>
      </div>

      {/* Case ID Badge */}
      {caseId && caseId !== 'initializing' && (
        <div className="mb-4 px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-500 font-mono">Case ID: </span>
          <span className="text-xs text-aegis-300 font-mono">{caseId}</span>
        </div>
      )}

      {/* Empty State */}
      {!hasEvents && !isStreaming && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-4xl mb-3 opacity-30">🔄</div>
          <p className="text-sm text-slate-500">Submit a document to see the agent pipeline in action</p>
          <p className="text-xs text-slate-600 mt-1">Each AI agent will appear here as it executes</p>
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
                isLastActive={activeNodeId === node.id}
              />
              {/* Animated connector between nodes */}
              {idx < PIPELINE_NODES.length - 1 && (
                <div className="flex justify-center my-1">
                  <div className={`pipeline-connector h-5 rounded-full ${
                    getNodeState(node.id, events).status === 'complete' ? 'active' : ''
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raw Log Stream (collapsible) */}
      {events.length > 0 && (
        <details className="mt-5 group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none flex items-center gap-1">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
            </svg>
            Raw event log ({events.length} events)
          </summary>
          <div ref={scrollRef} className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-slate-400 space-y-1">
            {events.map((event, i) => (
              <div key={i} className="leading-relaxed opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-slate-600">[{event.timestamp?.slice(11, 19) || '??:??:??'}]</span>{' '}
                <span className={
                  event.type === 'node_complete' ? 'text-emerald-400' :
                  event.type === 'node_error'    ? 'text-red-400' :
                  event.type === 'node_start'    ? 'text-aegis-400' :
                  event.type === 'pipeline_complete' ? 'text-purple-400' :
                  'text-slate-300'
                }>
                  {event.type}
                </span>{' '}
                {event.node && <span className="text-amber-400">[{event.node}]</span>}{' '}
                {event.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#1e3a8a',
    primaryTextColor: '#e2e8f0',
    primaryBorderColor: '#2563eb',
    lineColor: '#4a7fff',
    secondaryColor: '#0f1629',
    tertiaryColor: '#151d36',
    background: '#0a0e1a',
    mainBkg: '#0f1629',
    nodeBorder: '#2563eb',
    clusterBkg: '#151d36',
    titleColor: '#e2e8f0',
    edgeLabelBackground: '#0f1629',
    attributeBackgroundColorEven: '#151d36',
    attributeBackgroundColorOdd: '#0f1629',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
  securityLevel: 'loose',
})

const getBaseApiUrl = () => {
  const path = window.location.pathname;
  const proxyMatch = path.match(/(.*\/proxy\/8001)/);
  if (proxyMatch) {
    return `${proxyMatch[1].replace(/\/$/, '')}/api/`;
  }
  return '/api/';
};

export default function WorkflowDiagram() {
  const [diagram, setDiagram] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const diagramRef = useRef(null)
  const renderedRef = useRef(false)

  useEffect(() => {
    const fetchDiagram = async () => {
      try {
        const baseApi = getBaseApiUrl();
        const res = await fetch(`${baseApi}workflow/diagram`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setDiagram(data.diagram)
      } catch (err) {
        console.error('Failed to fetch workflow diagram:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchDiagram()
  }, [])

  useEffect(() => {
    if (!diagram || !diagramRef.current || renderedRef.current) return

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`
        const { svg } = await mermaid.render(id, diagram)
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg
          renderedRef.current = true
        }
      } catch (err) {
        console.error('Mermaid render error:', err)
        setError(`Diagram render failed: ${err.message}`)
      }
    }
    renderDiagram()
  }, [diagram])

  return (
    <div className="glass rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-white">Agent Workflow Diagram</h2>
          <p className="text-xs text-slate-400 mt-1">
            Live LangGraph state machine — rendered from the running backend
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded">
          <span>Live from API</span>
        </div>
      </div>

      {/* Pipeline legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { color: 'bg-purple-500', label: 'Security Shield' },
          { color: 'bg-blue-500',   label: 'LLM Extraction (AMD GPU)' },
          { color: 'bg-amber-500',  label: 'Watchlist Screening' },
          { color: 'bg-emerald-500',label: 'LLM Orchestrator (AMD GPU)' },
          { color: 'bg-rose-500',   label: 'PII Sanitizer' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className={`w-2 h-2 rounded-full ${color} opacity-80`} />
            {label}
          </div>
        ))}
      </div>

      {/* Diagram container */}
      <div className="mermaid-container rounded-lg bg-slate-950 border border-slate-800 p-4 min-h-64 flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-xs font-mono">Fetching workflow...</span>
          </div>
        )}
        {error && (
          <div className="text-center text-red-400 text-sm">
            <p>Could not render diagram</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{error}</p>
            <p className="text-xs text-slate-600 mt-2">Make sure the backend is running on port 8001</p>
          </div>
        )}
        {!loading && !error && (
          <div
            id="workflow-diagram-output"
            ref={diagramRef}
            className="w-full overflow-x-auto"
          />
        )}
      </div>

      {/* Technical details */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pipeline Nodes', value: '5 Agents' },
          { label: 'Conditional Edges', value: '2 Branch Points' },
          { label: 'LLM Calls', value: '2 (AMD GPU)' },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <div className="text-sm font-semibold text-white">{value}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Raw diagram source (collapsible) */}
      {diagram && (
        <details className="mt-4 group border-t border-slate-800 pt-3">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-350 transition-colors select-none flex items-center gap-1 font-mono">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
            </svg>
            View Mermaid source
          </summary>
          <pre className="mt-2 p-3 rounded bg-slate-955 text-xs font-mono text-slate-400 overflow-x-auto border border-slate-800">
            {diagram}
          </pre>
        </details>
      )}
    </div>
  )
}

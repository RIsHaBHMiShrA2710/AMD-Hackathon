import { useState, useCallback } from 'react'
import UploadPanel from './components/UploadPanel.jsx'
import ProgressTracker from './components/ProgressTracker.jsx'
import AuditReport from './components/AuditReport.jsx'
import WorkflowDiagram from './components/WorkflowDiagram.jsx'

/**
 * AegisKYC — Main Application Shell
 * 
 * Manages top-level state and coordinates between all components:
 *   - streamEvents: real-time events from the backend NDJSON stream
 *   - finalState:   the completed KYC case result
 *   - isStreaming:  whether the pipeline is currently running
 *   - activeTab:    which section the user is viewing
 */
export default function App() {
  const [streamEvents, setStreamEvents] = useState([])
  const [finalState, setFinalState] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTab, setActiveTab] = useState('process') // 'process' | 'diagram'
  const [caseId, setCaseId] = useState(null)

  // Called by UploadPanel when the user submits a document
  const handleStreamStart = useCallback((newCaseId) => {
    setStreamEvents([])
    setFinalState(null)
    setIsStreaming(true)
    setCaseId(newCaseId)
  }, [])

  // Called for each NDJSON event received from the backend stream
  const handleStreamEvent = useCallback((event) => {
    setStreamEvents(prev => [...prev, event])
  }, [])

  // Called when the stream completes (pipeline_complete event received)
  const handleStreamComplete = useCallback((state) => {
    setFinalState(state)
    setIsStreaming(false)
  }, [])

  // Called on stream error
  const handleStreamError = useCallback((error) => {
    setIsStreaming(false)
    setStreamEvents(prev => [...prev, {
      type: 'pipeline_error',
      message: `❌ Stream error: ${error}`,
      timestamp: new Date().toISOString(),
    }])
  }, [])

  const tabs = [
    { id: 'process', label: '⚡ Process Document' },
    { id: 'diagram', label: '🗺️ Workflow Diagram' },
  ]

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="glass border-b border-aegis-800/30 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aegis-500 to-purple-600 flex items-center justify-center text-lg font-bold shadow-lg">
              ⚔
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text tracking-tight">AegisKYC</h1>
              <p className="text-xs text-slate-400 font-mono">Agentic KYC Intelligence Platform</p>
            </div>
          </div>

          {/* AMD Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full amd-shimmer text-white text-xs font-bold tracking-wide shadow-lg">
              <span>⚡</span>
              <span>AMD ROCm GPU</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="Backend Online" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-6 pb-0 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? 'text-aegis-300 border-aegis-500 bg-aegis-900/20'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">

        {activeTab === 'process' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

            {/* Left column: Upload + Progress */}
            <div className="flex flex-col gap-6">
              <UploadPanel
                isStreaming={isStreaming}
                onStreamStart={handleStreamStart}
                onStreamEvent={handleStreamEvent}
                onStreamComplete={handleStreamComplete}
                onStreamError={handleStreamError}
              />
              <ProgressTracker
                events={streamEvents}
                isStreaming={isStreaming}
                caseId={caseId}
              />
            </div>

            {/* Right column: Audit Report */}
            <div>
              <AuditReport
                finalState={finalState}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        )}

        {activeTab === 'diagram' && (
          <WorkflowDiagram />
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600 font-mono">
        AegisKYC v1.0 · AMD Hackathon 2026 · LangGraph Multi-Agent Pipeline · AMD ROCm GPU Acceleration
      </footer>
    </div>
  )
}

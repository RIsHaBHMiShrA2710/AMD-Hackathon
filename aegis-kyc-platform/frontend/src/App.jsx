import { useState, useCallback } from 'react'
import UploadPanel from './components/UploadPanel.jsx'
import ProgressTracker from './components/ProgressTracker.jsx'
import AuditReport from './components/AuditReport.jsx'
import WorkflowDiagram from './components/WorkflowDiagram.jsx'
import PipelineModal from './components/PipelineModal.jsx'
import OCRPanel from './components/OCRPanel.jsx'
import FaceMatchPanel from './components/FaceMatchPanel.jsx'

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
  const [activeTab, setActiveTab] = useState('process') // 'process' | 'ocr' | 'face' | 'diagram'
  const [caseId, setCaseId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Called by UploadPanel when the user submits a document
  const handleStreamStart = useCallback((newCaseId) => {
    setStreamEvents([])
    setFinalState(null)
    setIsStreaming(true)
    setCaseId(newCaseId)
    setIsModalOpen(true)
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
    { id: 'process', label: 'Process Document' },
    { id: 'ocr', label: 'Multi-Language OCR' },
    { id: 'face', label: 'Biometric Face Match' },
    { id: 'diagram', label: 'Workflow Diagram' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-base font-bold text-slate-200">
              AE
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">AegisKYC</h1>
              <p className="text-[10px] text-slate-400 font-mono">Enterprise Agentic KYC Orchestration</p>
            </div>
          </div>

          {/* AMD Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
              <span>AMD ROCm Engine</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500" title="Backend Online" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-6 pb-0 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-150 border-b-2 ${
                activeTab === tab.id
                  ? 'text-white border-indigo-500 bg-slate-950'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/50'
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
                onOpenModal={() => setIsModalOpen(true)}
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

        {activeTab === 'ocr' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 flex flex-col gap-6">
              <OCRPanel
                isStreaming={isStreaming}
                onStreamStart={handleStreamStart}
                onStreamEvent={handleStreamEvent}
                onStreamComplete={handleStreamComplete}
                onStreamError={handleStreamError}
              />
            </div>
            <div className="flex flex-col gap-6">
              <AuditReport
                finalState={finalState}
                isStreaming={isStreaming}
              />
              <ProgressTracker
                events={streamEvents}
                isStreaming={isStreaming}
                caseId={caseId}
                onOpenModal={() => setIsModalOpen(true)}
              />
            </div>
          </div>
        )}

        {activeTab === 'face' && (
          <div className="animate-fade-in">
            <FaceMatchPanel />
          </div>
        )}

        {activeTab === 'diagram' && (
          <WorkflowDiagram />
        )}
      </main>

      {/* Pipeline Modal Overlay */}
      <PipelineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        events={streamEvents}
        isStreaming={isStreaming}
      />

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600 font-mono">
        AegisKYC v1.0 · AMD Hackathon 2026 · LangGraph Multi-Agent Pipeline · AMD ROCm GPU Acceleration
      </footer>
    </div>
  )
}

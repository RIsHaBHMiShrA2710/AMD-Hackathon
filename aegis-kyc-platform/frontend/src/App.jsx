import { useState } from 'react'
import KYCWizard from './components/KYCWizard.jsx'
import FaceMatchPanel from './components/FaceMatchPanel.jsx'
import WorkflowDiagram from './components/WorkflowDiagram.jsx'

export default function App() {
  const [activeTab, setActiveTab] = useState('process')

  const tabs = [
    { id: 'process', label: 'KYC Verification' },
    { id: 'face',    label: 'Biometric Demo' },
    { id: 'diagram', label: 'Workflow Diagram' },
  ]

  return (
    <div className="min-h-screen bg-[#080d15] flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-[#0f1623] border-b border-[#1a2332] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-sm font-bold text-white">
              AK
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">AegisKYC</h1>
              <p className="text-[10px] text-slate-500 font-mono">Agentic KYC Orchestration · AMD ROCm</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
              AMD ROCm · MI300X
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-0 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-150 border-b-2 ${
                activeTab === tab.id
                  ? 'text-white border-sky-500 bg-[#080d15]'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === 'process' && <KYCWizard />}
        {activeTab === 'face'    && <FaceMatchPanel />}
        {activeTab === 'diagram' && <WorkflowDiagram />}
      </main>

      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-700 font-mono">
        AegisKYC v2.0 · AMD Hackathon 2026 · LangGraph Multi-Agent Pipeline · AMD ROCm GPU Acceleration
      </footer>
    </div>
  )
}

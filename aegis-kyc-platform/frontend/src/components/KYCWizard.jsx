import { useState, useCallback } from 'react'
import PipelineStageTracker from './PipelineStageTracker.jsx'

const OCR_PRESETS = [
  { id: "rahul", label: "Aadhaar — Rahul Sharma (Clean)", filename: "aadhaar_rahul_sharma.png", selfie: "selfie_rahul_sharma.png", scenario: "Clean bilingual Aadhaar. Expected outcome: APPROVED." },
  { id: "amit", label: "PAN — Amit Kumar (Clean)", filename: "pan_amit_kumar.png", selfie: "selfie_amit_kumar.png", scenario: "Standard PAN card. Expected outcome: APPROVED." },
  { id: "devendra", label: "Aadhaar — Devendra Singh (Watchlist)", filename: "aadhaar_devendra_singh.png", selfie: "selfie_devendra_singh.png", scenario: "Name fuzzy-matches watchlist entity 'Devendra Sen'. Expected outcome: MANUAL REVIEW." },
  { id: "viktor", label: "Passport — Viktor Sokolov (Blocked)", filename: "passport_viktor_sokolov.png", selfie: "selfie_viktor_sokolov.png", scenario: "Passport serial P1122334 matches suspended passport DB + sanctions list. Expected outcome: ESCALATED." },
  { id: "priya", label: "Aadhaar — Priya Patel (Tampered)", filename: "aadhaar_priya_patel_tampered.png", selfie: "selfie_priya_patel.png", scenario: "DOB in document (1985) mismatches government registry (1995). Expected outcome: ESCALATED." },
]

const SELFIE_OPTS = [
  { label: "Matching Selfie", key: "match" },
  { label: "Spoof / Liveness Fail", key: "spoof" },
  { label: "Different Person (Mismatch)", key: "mismatch" },
]

const INITIAL_STAGES = [
  { id: 'document', label: 'Document Scan', icon: 'document', status: 'idle', message: '' },
  { id: 'ocr', label: 'OCR Extract', icon: 'ocr', status: 'idle', message: '' },
  { id: 'compliance', label: 'Compliance', icon: 'compliance', status: 'idle', message: '' },
  { id: 'face', label: 'Face Verify', icon: 'face', status: 'idle', message: '' },
  { id: 'decision', label: 'Decision', icon: 'decision', status: 'idle', message: '' },
]

const getSampleUrl = () => {
  const m = window.location.pathname.match(/(.*\/proxy\/8001)/)
  return m ? `${m[1]}/sample_documents/` : '/sample_documents/'
}
const getApiUrl = () => {
  const m = window.location.pathname.match(/(.*\/proxy\/8001)/)
  return m ? `${m[1]}/api/` : '/api/'
}

function setStage(stages, id, update) {
  return stages.map(s => s.id === id ? { ...s, ...update } : s)
}

/* ── Escalation Breakdown ─────────────────────────────────────────────── */
function EscalationBreakdown({ finalState }) {
  const reasons = []
  const { compliance_flags = [], confidence_score, final_decision, audit_summary } = finalState

  compliance_flags.forEach(f => {
    const isRegistry = f.watchlist_id === 'GOV-REGISTRY'
    reasons.push({
      severity: f.risk_tier === 'HIGH' ? 'high' : 'medium',
      title: isRegistry ? 'Government Registry Mismatch' : `Sanctions/Watchlist Match — ${f.matched_name}`,
      detail: f.reason || `Matched entity "${f.matched_name}" with ${f.score}% confidence from ${f.watchlist_id}.`,
      icon: isRegistry ? '🏛️' : '⚠️',
    })
  })

  if (finalState.ocr_bilingual_match_status === 'MISMATCH') {
    reasons.push({ severity: 'medium', icon: '🔤', title: 'Bilingual Name Mismatch', detail: finalState.ocr_bilingual_match_rationale || 'Hindi and English name fields on document do not match.' })
  }

  if (finalState.face_match_verified === false || finalState.face_verified === false) {
    reasons.push({ severity: 'high', icon: '👤', title: 'Biometric Verification Failed', detail: finalState.face_match_reason || 'Facial landmark analysis failed. Possible spoofing or identity mismatch detected.' })
  }

  if (!reasons.length && audit_summary) {
    reasons.push({ severity: 'medium', icon: '📋', title: 'Compliance Review Required', detail: audit_summary })
  }

  if (!reasons.length) return null

  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mb-2">
        Escalation Breakdown ({reasons.length} point{reasons.length !== 1 ? 's' : ''})
      </h4>
      {reasons.map((r, i) => (
        <div key={i} className={`p-3 rounded-lg border ${
          r.severity === 'high' ? 'bg-red-950/30 border-red-800/60' : 'bg-amber-950/20 border-amber-800/50'
        }`}>
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5 flex-shrink-0">{r.icon}</span>
            <div>
              <p className={`text-xs font-semibold ${r.severity === 'high' ? 'text-red-300' : 'text-amber-300'}`}>{r.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{r.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Final Result Card ────────────────────────────────────────────────── */
function FinalResult({ finalState, faceResult, onReset }) {
  const decision = finalState?.final_decision || 'PENDING'
  const isApproved = decision === 'APPROVE'
  const isReview = decision === 'REVIEW'
  const isEscalated = decision === 'ESCALATE'

  const mergedState = { ...finalState, face_verified: faceResult?.verified, face_match_reason: faceResult?.reason }

  return (
    <div className="animate-slide-up space-y-4">
      {/* Decision hero */}
      <div className={`rounded-xl p-6 text-center border ${
        isApproved  ? 'bg-emerald-950/40 border-emerald-600' :
        isReview    ? 'bg-amber-950/30 border-amber-600' :
        'bg-red-950/30 border-red-600'
      }`}>
        <div className="text-4xl mb-2">{isApproved ? '✓' : isReview ? '⚠' : '✕'}</div>
        <div className={`text-2xl font-bold tracking-widest ${
          isApproved ? 'text-emerald-300' : isReview ? 'text-amber-300' : 'text-red-300'
        }`}>
          {isApproved ? 'APPROVED' : isReview ? 'MANUAL REVIEW' : 'ESCALATED'}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {isApproved  ? 'Identity verified — no issues detected' :
           isReview    ? 'Compliance review required before onboarding' :
           'High-risk case — immediate escalation triggered'}
        </p>
      </div>

      {/* Escalation breakdown */}
      {(isEscalated || isReview) && <EscalationBreakdown finalState={mergedState} />}

      {/* Extracted data */}
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Full Name', finalState?.extracted_data?.full_name],
          ['Date of Birth', finalState?.extracted_data?.date_of_birth],
          ['Nationality', finalState?.extracted_data?.nationality],
          ['Document Type', finalState?.extracted_data?.document_type],
          ['Document No.', finalState?.extracted_data?.document_number],
          ['Confidence', finalState?.confidence_score !== undefined ? `${(finalState.confidence_score * 100).toFixed(1)}%` : null],
        ].filter(([,v]) => v && v !== 'UNKNOWN').map(([label, value]) => (
          <div key={label} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{label}</div>
            <div className="text-sm text-slate-200 font-medium mt-0.5 truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Biometric result */}
      {faceResult && (
        <div className={`p-4 rounded-lg border ${faceResult.verified ? 'bg-emerald-950/30 border-emerald-800' : 'bg-red-950/30 border-red-800'}`}>
          <div className="text-xs font-semibold font-mono uppercase tracking-wider mb-1 text-slate-400">Biometric Verification</div>
          <div className={`text-sm font-bold ${faceResult.verified ? 'text-emerald-300' : 'text-red-300'}`}>
            {faceResult.verified ? '✓ Face Matched' : '✕ Biometric Mismatch'}
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{faceResult.reason}</p>
        </div>
      )}

      {/* Audit summary */}
      {finalState?.audit_summary && (
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Audit Summary</div>
          <p className="text-xs text-slate-300 leading-relaxed">{finalState.audit_summary}</p>
        </div>
      )}

      <button onClick={onReset} className="w-full py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:border-slate-500 hover:text-white transition-all">
        Start New Verification
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN WIZARD
   ══════════════════════════════════════════════════════════════════════════ */
export default function KYCWizard() {
  const [step, setStep] = useState(1) // 1=select, 2=processing, 3=face, 4=result
  const [presetIdx, setPresetIdx] = useState(0)
  const [selfieMode, setSelfieMode] = useState('match')
  const [stages, setStages] = useState(INITIAL_STAGES)
  const [finalState, setFinalState] = useState(null)
  const [faceResult, setFaceResult] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isVerifyingFace, setIsVerifyingFace] = useState(false)
  const [ocrData, setOcrData] = useState(null)

  const preset = OCR_PRESETS[presetIdx]
  const imgBase = getSampleUrl()

  const getSelfieFilename = () => {
    if (selfieMode === 'spoof') return 'selfie_rahul_sharma_spoof.png'
    if (selfieMode === 'mismatch') return 'selfie_devendra_singh.png'
    return preset.selfie
  }

  const updateStage = useCallback((id, update) => {
    setStages(prev => setStage(prev, id, update))
  }, [])

  const handleRunAnalysis = async () => {
    setIsRunning(true)
    setFinalState(null)
    setFaceResult(null)
    setOcrData(null)
    setStages(INITIAL_STAGES)
    setStep(2)

    updateStage('document', { status: 'active', message: 'Scanning...' })

    try {
      const baseApi = getApiUrl()
      const response = await fetch(`${baseApi}kyc/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: '', input_type: 'image', image_filename: preset.filename }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      updateStage('document', { status: 'success', message: 'Loaded' })
      updateStage('ocr', { status: 'active', message: 'Extracting...' })

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const event = JSON.parse(trimmed)

            if (event.type === 'node_start' || event.type === 'node_progress') {
              const n = event.node
              if (n === 'ocr_agent') updateStage('ocr', { status: 'active', message: 'Reading text...' })
              if (n === 'extraction_agent') updateStage('ocr', { status: 'active', message: 'Parsing fields...' })
              if (n === 'compliance_agent') {
                updateStage('ocr', { status: 'success', message: 'Done' })
                updateStage('compliance', { status: 'active', message: 'Screening...' })
              }
              if (n === 'orchestrator_agent') updateStage('compliance', { status: 'active', message: 'Deciding...' })
            }

            if (event.type === 'node_complete') {
              const n = event.node
              if (n === 'ocr_agent') updateStage('ocr', { status: 'success', message: 'Extracted' })
              if (n === 'compliance_agent') {
                const flagCount = event.data?.flags_count || 0
                updateStage('compliance', {
                  status: flagCount > 0 ? 'warning' : 'success',
                  message: flagCount > 0 ? `${flagCount} flag(s)` : 'Clear'
                })
              }
            }

            if (event.type === 'pipeline_complete') {
              const fs = event.final_state
              setFinalState(fs)
              setOcrData(fs)
              updateStage('ocr', { status: 'success', message: 'Done' })
              updateStage('compliance', prev => prev.status === 'idle' ? { status: 'success', message: 'Clear' } : prev)
              updateStage('face', { status: 'idle', message: '' })
              updateStage('decision', { status: 'idle', message: '' })
              setStep(3)
            }

            if (event.type === 'pipeline_error') throw new Error(event.error || 'Pipeline failed')
          } catch (parseErr) { /* skip bad lines */ }
        }
      }
    } catch (err) {
      updateStage('ocr', { status: 'failed', message: err.message })
      updateStage('compliance', { status: 'failed', message: 'Aborted' })
    } finally {
      setIsRunning(false)
    }
  }

  const handleVerifyFace = async () => {
    setIsVerifyingFace(true)
    updateStage('face', { status: 'active', message: 'Matching...' })

    try {
      const baseApi = getApiUrl()
      const res = await fetch(`${baseApi}kyc/face-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_image_filename: preset.filename, selfie_image_filename: getSelfieFilename() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFaceResult(data)

      updateStage('face', {
        status: data.verified ? 'success' : 'failed',
        message: data.verified ? 'Matched' : 'Mismatch'
      })

      // Final decision
      const docDecision = finalState?.final_decision || 'APPROVE'
      const faceOk = data.verified
      let finalDecision = docDecision
      if (!faceOk && docDecision === 'APPROVE') finalDecision = 'ESCALATE'

      updateStage('decision', {
        status: finalDecision === 'APPROVE' ? 'success' : finalDecision === 'REVIEW' ? 'warning' : 'failed',
        message: finalDecision
      })

      setFinalState(prev => ({ ...prev, final_decision: finalDecision, face_verified: faceOk, face_match_reason: data.reason }))
      setStep(4)
    } catch (err) {
      updateStage('face', { status: 'failed', message: 'Error' })
      updateStage('decision', { status: 'failed', message: 'Failed' })
    } finally {
      setIsVerifyingFace(false)
    }
  }

  const handleReset = () => {
    setStep(1)
    setStages(INITIAL_STAGES)
    setFinalState(null)
    setFaceResult(null)
    setOcrData(null)
    setSelfieMode('match')
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Stage Tracker ──────────────────────────────────────────────── */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">KYC Verification</h2>
            <p className="text-xs text-slate-500 mt-0.5">End-to-end identity verification pipeline</p>
          </div>
          {step > 1 && step < 4 && (
            <button onClick={handleReset} className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors">Reset</button>
          )}
        </div>
        <PipelineStageTracker stages={stages} />
      </div>

      {/* ── Step 1: Document Selector ──────────────────────────────────── */}
      {step === 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in">
          <div className="glass rounded-xl p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Select ID Document</h3>
              <p className="text-xs text-slate-500">Choose a preset document card. OCR will extract all fields automatically.</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-mono mb-1.5 block">Document Preset</label>
              <select
                value={presetIdx}
                onChange={e => setPresetIdx(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-sky-500 transition-colors cursor-pointer"
              >
                {OCR_PRESETS.map((p, i) => <option key={p.id} value={i}>{p.label}</option>)}
              </select>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs text-slate-400 font-mono leading-relaxed">
              {preset.scenario}
            </div>
            <button
              onClick={handleRunAnalysis}
              className="mt-auto w-full py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors"
            >
              Extract &amp; Analyse Document →
            </button>
          </div>

          <div className="glass rounded-xl p-6 flex flex-col items-center">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider self-start mb-3">Document Preview</div>
            <img
              src={`${imgBase}${preset.filename}`}
              alt={preset.label}
              className="w-full max-w-sm h-auto rounded-lg border border-slate-800 object-contain"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Processing ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="glass rounded-xl p-8 flex flex-col items-center justify-center gap-4 min-h-48 animate-fade-in">
          <div className="w-10 h-10 rounded-full border-2 border-sky-500/30 border-t-sky-500 animate-spin" />
          <div className="text-sm font-semibold text-sky-400">Running KYC Pipeline...</div>
          <div className="text-xs text-slate-500 font-mono">OCR → Entity Extraction → Compliance Screening</div>
        </div>
      )}

      {/* ── Step 3: Face Verification ──────────────────────────────────── */}
      {step === 3 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-slide-up">
          {/* OCR results summary */}
          {ocrData && (
            <div className="glass rounded-xl p-6 flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Extracted Identity</h3>
                <p className="text-xs text-slate-500">OCR pipeline complete. Review extracted fields below.</p>
              </div>
              <div className="space-y-2">
                {[
                  ['Full Name', ocrData.extracted_data?.full_name],
                  ['Date of Birth', ocrData.extracted_data?.date_of_birth],
                  ['Nationality', ocrData.extracted_data?.nationality],
                  ['Document Type', ocrData.extracted_data?.document_type],
                  ['Document No.', ocrData.extracted_data?.document_number],
                ].filter(([,v]) => v && v !== 'UNKNOWN').map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                    <span className="text-[11px] font-mono text-slate-500 uppercase">{label}</span>
                    <span className="text-sm text-slate-200 font-medium">{val}</span>
                  </div>
                ))}
                {ocrData.ocr_language_detected && (
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                    <span className="text-[11px] font-mono text-slate-500 uppercase">OCR Language</span>
                    <span className="text-sm text-sky-400 font-medium">{ocrData.ocr_language_detected}</span>
                  </div>
                )}
                {ocrData.ocr_bilingual_match_status && ocrData.ocr_bilingual_match_status !== 'SKIPPED' && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[11px] font-mono text-slate-500 uppercase">Bilingual Match</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ocrData.ocr_bilingual_match_status === 'MATCHED' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                      {ocrData.ocr_bilingual_match_status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Face verification */}
          <div className="glass rounded-xl p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Biometric Face Verification</h3>
              <p className="text-xs text-slate-500">Select the customer selfie to compare against the extracted ID photo.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">ID Document</div>
                <img src={`${imgBase}${preset.filename}`} alt="ID" className="w-full h-28 object-cover rounded-lg border border-slate-800" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Customer Selfie</div>
                <img src={`${imgBase}${getSelfieFilename()}`} alt="Selfie" className="w-full h-28 object-cover rounded-lg border border-slate-800" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-mono mb-1.5 block">Selfie Scenario</label>
              <select
                value={selfieMode}
                onChange={e => setSelfieMode(e.target.value)}
                disabled={isVerifyingFace}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-colors"
              >
                {SELFIE_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>

            <button
              onClick={handleVerifyFace}
              disabled={isVerifyingFace}
              className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
                isVerifyingFace ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              {isVerifyingFace ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Verifying...
                </span>
              ) : 'Verify Identity →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Final Result ───────────────────────────────────────── */}
      {step === 4 && finalState && (
        <div className="max-w-2xl mx-auto w-full">
          <FinalResult finalState={finalState} faceResult={faceResult} onReset={handleReset} />
        </div>
      )}
    </div>
  )
}

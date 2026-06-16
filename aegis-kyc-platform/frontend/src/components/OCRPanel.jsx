import { useState } from 'react'

const OCR_PRESETS = [
  {
    id: "preset_rahul_sharma",
    label: "Valid Aadhaar Card (Rahul Sharma) — Clean",
    image_filename: "aadhaar_rahul_sharma.png",
    description: "Standard bilingual (Hindi + English) Aadhaar card with clean record."
  },
  {
    id: "preset_amit_kumar",
    label: "Valid PAN Card (Amit Kumar) — Clean",
    image_filename: "pan_amit_kumar.png",
    description: "Standard English PAN card with active registry record."
  },
  {
    id: "preset_devendra_singh",
    label: "Bilingual Aadhaar Card (Devendra Singh) — Watchlist Alert",
    image_filename: "aadhaar_devendra_singh.png",
    description: "Bilingual Aadhaar. Extracted name 'Devendra Singh' fuzzy matches watchlist designated entity 'Devendra Sen'."
  },
  {
    id: "preset_viktor_sokolov",
    label: "Suspended Passport (Viktor Sokolov) — High Risk Blocked",
    image_filename: "passport_viktor_sokolov.png",
    description: "Standard Passport. Serial number P1122334 matches suspended passport database."
  },
  {
    id: "preset_priya_patel_tampered",
    label: "Tampered Aadhaar Card (Priya Patel) — Fraud Alert",
    image_filename: "aadhaar_priya_patel_tampered.png",
    description: "Tampered Aadhaar. Extracted DOB (1985) mismatches registry database DOB (1995)."
  }
]

const getSampleDocumentsUrl = () => {
  const path = window.location.pathname;
  const proxyMatch = path.match(/(.*\/proxy\/8001)/);
  if (proxyMatch) {
    return `${proxyMatch[1].replace(/\/$/, '')}/sample_documents/`;
  }
  return '/sample_documents/';
};

const getBaseApiUrl = () => {
  const path = window.location.pathname;
  const proxyMatch = path.match(/(.*\/proxy\/8001)/);
  if (proxyMatch) {
    return `${proxyMatch[1].replace(/\/$/, '')}/api/`;
  }
  return '/api/';
};

export default function OCRPanel({
  isStreaming,
  onStreamStart,
  onStreamEvent,
  onStreamComplete,
  onStreamError
}) {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0)
  const [ocrResult, setOcrResult] = useState(null)

  const selectedPreset = OCR_PRESETS[selectedPresetIndex]
  const imagesBaseUrl = getSampleDocumentsUrl()

  const handleRunOCR = async () => {
    if (isStreaming) return
    setOcrResult(null)

    try {
      const baseApi = getBaseApiUrl()
      const response = await fetch(`${baseApi}kyc/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_text: "",
          input_type: "image",
          image_filename: selectedPreset.image_filename
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      onStreamStart('initializing')

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
            onStreamEvent(event)

            if (event.type === 'pipeline_complete') {
              onStreamComplete(event.final_state)
              setOcrResult(event.final_state)
            } else if (event.type === 'pipeline_error') {
              onStreamError(event.error || 'Unknown pipeline error')
            }
          } catch (parseErr) {
            console.warn('Failed to parse NDJSON line:', trimmed, parseErr)
          }
        }
      }
    } catch (err) {
      onStreamError(err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Preset Selector & Image Preview */}
      <div className="lg:col-span-3 flex flex-col gap-5">
        <div className="glass rounded-lg p-6">
          <h2 className="text-base font-semibold text-white mb-2">OCR Document Scans</h2>
          <p className="text-xs text-slate-400 mb-4">Select a synthetic document card to run OCR and verify identity details.</p>
          
          {/* Dropdown */}
          <div className="mb-4">
            <label className="text-xs text-slate-500 font-mono mb-1.5 block">Select Preset Document</label>
            <select
              value={selectedPresetIndex}
              onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
              disabled={isStreaming}
              className="w-full bg-slate-955 border border-slate-750 text-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {OCR_PRESETS.map((preset, idx) => (
                <option key={preset.id} value={idx}>{preset.label}</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-405 font-mono p-3 bg-slate-900 rounded border border-slate-800 leading-relaxed mb-5">
            {selectedPreset.description}
          </p>

          {/* Trigger button */}
          <button
            onClick={handleRunOCR}
            disabled={isStreaming}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-150 ${
              isStreaming
                ? 'bg-slate-800 text-slate-650 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98]'
            }`}
          >
            {isStreaming ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Processing OCR...</span>
              </>
            ) : (
              <>
                <span>Scan Document card</span>
              </>
            )}
          </button>
        </div>

        {/* Card Image Display */}
        <div className="glass rounded-lg p-6 flex flex-col items-center justify-center border border-slate-800">
          <div className="text-[10px] text-slate-500 font-mono mb-3 uppercase tracking-wider self-start">Document Image Preview</div>
          <img
            src={`${imagesBaseUrl}${selectedPreset.image_filename}`}
            alt={selectedPreset.label}
            className="w-full h-auto max-w-[480px] rounded-lg border border-slate-800"
          />
        </div>
      </div>

      {/* OCR Results Analysis */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="glass rounded-lg p-6 flex-1 flex flex-col">
          <h2 className="text-base font-semibold text-white mb-2">OCR Analysis Output</h2>
          <p className="text-xs text-slate-400 mb-4">Extracted data verification and layout transliterated flags</p>

          {!ocrResult && !isStreaming && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
              <p className="text-sm font-medium text-slate-400 font-mono">No active scan</p>
              <p className="text-xs text-slate-550 mt-1">Select a document card preset and click 'Scan'</p>
            </div>
          )}

          {isStreaming && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/25 border-t-indigo-500 animate-spin mb-4" />
              <p className="text-sm text-indigo-305 font-medium animate-pulse">Running OCR Extractors...</p>
            </div>
          )}

          {ocrResult && !isStreaming && (
            <div className="space-y-4 animate-fade-in flex-1">
              {/* Language Detected */}
              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Language Detected</span>
                <span className="text-sm font-semibold text-indigo-400 mt-0.5 block">
                  {ocrResult.ocr_language_detected}
                </span>
              </div>

              {/* Bilingual Match Status */}
              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Bilingual Name Validation</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2.5 py-1 rounded font-bold ${
                    ocrResult.ocr_bilingual_match_status === 'MATCHED'
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                      : ocrResult.ocr_bilingual_match_status === 'MISMATCH'
                        ? 'bg-red-950/40 text-red-400 border border-red-900/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}>
                    {ocrResult.ocr_bilingual_match_status}
                  </span>
                  {ocrResult.ocr_bilingual_match_score !== undefined && (
                    <span className="text-xs font-mono text-slate-400">
                      (Confidence: {(ocrResult.ocr_bilingual_match_score * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Rationale */}
              {ocrResult.ocr_bilingual_match_rationale && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">Transliteration Rationale</span>
                  <p className="text-xs text-slate-350 leading-relaxed font-sans">
                    {ocrResult.ocr_bilingual_match_rationale}
                  </p>
                </div>
              )}

              {/* Raw Extracted Text */}
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">Raw OCR Text Output</span>
                <textarea
                  readOnly
                  value={ocrResult.ocr_text}
                  className="w-full flex-1 min-h-[160px] p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

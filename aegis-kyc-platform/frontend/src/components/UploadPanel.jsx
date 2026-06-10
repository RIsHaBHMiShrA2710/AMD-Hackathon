import { useState, useRef } from 'react'

/**
 * UploadPanel — Document submission interface
 * 
 * Provides a textarea for pasting document text and a file upload button.
 * On submit, opens a streaming NDJSON connection to POST /api/kyc/stream
 * and feeds each line as a parsed event to the parent via callbacks.
 * 
 * Stream reading strategy:
 *   - Uses fetch() with ReadableStream + TextDecoder for native NDJSON parsing
 *   - Processes line-by-line so partial chunks are buffered correctly
 *   - Each complete JSON line is parsed and dispatched as an event object
 */

const SAMPLE_DOCUMENTS = [
  {
    label: "✅ Clean Passport",
    text: "PASSPORT\nSurname: THOMPSON\nGiven Names: ALICE MARIE\nNationality: UNITED STATES\nDate of Birth: 12 SEP 1990\nSex: F\nPlace of Birth: NEW YORK\nDate of Issue: 05 MAR 2020\nDate of Expiry: 04 MAR 2030\nPassport No: US98765432\nPersonal No: 123456789"
  },
  {
    label: "🚨 Sanctioned Entity",
    text: "IDENTIFICATION DOCUMENT\nFull Name: Viktor Sokolov\nDate of Birth: 1978-11-22\nNationality: Russian Federation\nDocument Type: National ID\nDocument Number: RU-44556677\nIssued By: Federal Migration Service\nValid Until: 2028-12-31"
  },
  {
    label: "🟡 Review Case",
    text: "DRIVING LICENSE\nName: James Victor Volkov\nDOB: March 3, 1985\nCountry: Ukraine\nLicense No: UA-DL-9988776\nCategory: B, C\nIssued: 2019-01-15\nExpiry: 2029-01-14\nAddress: 14 Kyiv Street, Kyiv"
  }
]

export default function UploadPanel({
  isStreaming,
  onStreamStart,
  onStreamEvent,
  onStreamComplete,
  onStreamError,
}) {
  const [documentText, setDocumentText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  // ── File Upload Handler ────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setDocumentText(ev.target.result)
    reader.readAsText(file)
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setDocumentText(ev.target.result)
      reader.readAsText(file)
    }
  }

  // ── NDJSON Stream Reader ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!documentText.trim() || isStreaming) return

    try {
      const response = await fetch('/api/kyc/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: documentText }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let caseStarted = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process all complete lines (NDJSON = one JSON object per line)
        const lines = buffer.split('\n')
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const event = JSON.parse(trimmed)

            // Announce case start on first event
            if (!caseStarted && event.case_id) {
              onStreamStart(event.case_id)
              caseStarted = true
            } else if (!caseStarted) {
              onStreamStart('initializing')
              caseStarted = true
            }

            onStreamEvent(event)

            // Pipeline complete — extract final state
            if (event.type === 'pipeline_complete') {
              onStreamComplete(event.final_state)
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
    <div className="glass rounded-2xl p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Document Submission</h2>
          <p className="text-xs text-slate-400 mt-0.5">Paste or upload a KYC document for AI-powered analysis</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-aegis-900/50 border border-aegis-700/30 flex items-center justify-center text-lg">
          📋
        </div>
      </div>

      {/* Sample Document Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-slate-500 self-center">Try sample:</span>
        {SAMPLE_DOCUMENTS.map((doc, i) => (
          <button
            key={i}
            id={`sample-doc-${i}`}
            onClick={() => setDocumentText(doc.text)}
            disabled={isStreaming}
            className="text-xs px-2.5 py-1 rounded-full border border-slate-700 text-slate-300 hover:border-aegis-500 hover:text-aegis-300 transition-colors disabled:opacity-50"
          >
            {doc.label}
          </button>
        ))}
      </div>

      {/* Text Area */}
      <div
        className={`relative rounded-xl border-2 transition-all duration-200 ${
          isDragging
            ? 'border-aegis-400 bg-aegis-900/30'
            : 'border-slate-700 hover:border-slate-600'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <textarea
          id="document-text-input"
          value={documentText}
          onChange={(e) => setDocumentText(e.target.value)}
          disabled={isStreaming}
          placeholder="Paste document text here... (passport, national ID, driving license)

Or drag & drop a .txt file"
          className="w-full h-52 px-4 py-3 bg-transparent text-sm text-slate-200 placeholder-slate-600 font-mono resize-none outline-none disabled:opacity-50"
        />
        {isDragging && (
          <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-aegis-900/60 backdrop-blur-sm">
            <span className="text-aegis-300 font-medium">Drop file here</span>
          </div>
        )}
      </div>

      {/* Character count */}
      <div className="flex justify-end mt-1 mb-4">
        <span className="text-xs text-slate-600 font-mono">{documentText.length} chars</span>
      </div>

      {/* Actions Row */}
      <div className="flex items-center gap-3">
        {/* File upload */}
        <button
          id="file-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:border-slate-500 hover:text-white transition-all disabled:opacity-50"
        >
          <span>📁</span>
          <span>Upload File</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Clear */}
        <button
          id="clear-btn"
          onClick={() => setDocumentText('')}
          disabled={isStreaming || !documentText}
          className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-slate-500 transition-all disabled:opacity-40"
        >
          Clear
        </button>

        {/* Submit — primary CTA */}
        <button
          id="submit-kyc-btn"
          onClick={handleSubmit}
          disabled={isStreaming || !documentText.trim()}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isStreaming || !documentText.trim()
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-aegis-600 to-purple-600 text-white hover:from-aegis-500 hover:to-purple-500 shadow-lg hover:shadow-aegis-500/25 active:scale-95'
          }`}
        >
          {isStreaming ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Run KYC Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

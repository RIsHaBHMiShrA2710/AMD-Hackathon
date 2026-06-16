import { useState } from 'react'

const DOC_PRESETS = [
  { label: "Rahul Sharma (Aadhaar)", filename: "aadhaar_rahul_sharma.png" },
  { label: "Amit Kumar (PAN)", filename: "pan_amit_kumar.png" },
  { label: "Devendra Singh (Aadhaar)", filename: "aadhaar_devendra_singh.png" },
  { label: "Viktor Sokolov (Passport)", filename: "passport_viktor_sokolov.png" },
  { label: "Priya Patel (Aadhaar)", filename: "aadhaar_priya_patel_tampered.png" }
]

const SELFIE_PRESETS = [
  { label: "Rahul Sharma (Selfie - Matching)", filename: "selfie_rahul_sharma.png" },
  { label: "Rahul Sharma (Selfie - Spoof/Biometric Mismatch)", filename: "selfie_rahul_sharma_spoof.png" },
  { label: "Amit Kumar (Selfie - Matching)", filename: "selfie_amit_kumar.png" },
  { label: "Devendra Singh (Selfie - Matching)", filename: "selfie_devendra_singh.png" },
  { label: "Viktor Sokolov (Selfie - Matching)", filename: "selfie_viktor_sokolov.png" },
  { label: "Priya Patel (Selfie - Matching)", filename: "selfie_priya_patel.png" },
  { label: "Devendra Singh (Selfie - Biometric Mismatch/Different Person for Rahul ID)", filename: "selfie_devendra_singh.png" }
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

export default function FaceMatchPanel() {
  const [docIndex, setDocIndex] = useState(0)
  const [selfieIndex, setSelfieIndex] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [error, setError] = useState(null)

  const selectedDoc = DOC_PRESETS[docIndex]
  const selectedSelfie = SELFIE_PRESETS[selfieIndex]
  const imagesBaseUrl = getSampleDocumentsUrl()

  const handleVerify = async () => {
    setIsScanning(true)
    setError(null)
    setMatchResult(null)

    await new Promise(resolve => setTimeout(resolve, 1000))

    try {
      const baseApi = getBaseApiUrl()
      const response = await fetch(`${baseApi}kyc/face-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_image_filename: selectedDoc.filename,
          selfie_image_filename: selectedSelfie.filename
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setMatchResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Settings & Visual Scan */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        <div className="glass rounded-lg p-6">
          <h2 className="text-base font-semibold text-white mb-2">Biometric Face Verification</h2>
          <p className="text-xs text-slate-400 mb-5">Select a document card and a client selfie. Aegis matches landmarks and outputs a similarity index.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs text-slate-500 font-mono mb-1.5 block">1. ID Document Image</label>
              <select
                value={docIndex}
                onChange={(e) => setDocIndex(Number(e.target.value))}
                disabled={isScanning}
                className="w-full bg-slate-950 border border-slate-750 text-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                {DOC_PRESETS.map((doc, idx) => (
                  <option key={idx} value={idx}>{doc.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-mono mb-1.5 block">2. Customer Live Selfie</label>
              <select
                value={selfieIndex}
                onChange={(e) => setSelfieIndex(Number(e.target.value))}
                disabled={isScanning}
                className="w-full bg-slate-950 border border-slate-750 text-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                {SELFIE_PRESETS.map((selfie, idx) => (
                  <option key={idx} value={idx}>{selfie.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleVerify}
            disabled={isScanning}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-semibold text-sm transition-all duration-150 ${
              isScanning
                ? 'bg-slate-800 text-slate-650 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98]'
            }`}
          >
            {isScanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Analyzing Facial Embeddings...</span>
              </>
            ) : (
              <span>Verify Biometric Face Match</span>
            )}
          </button>
        </div>

        {/* Biometric Comparison Frame */}
        <div className="glass rounded-lg p-6 flex flex-col border border-slate-800">
          <div className="text-[10px] text-slate-500 font-mono mb-4 uppercase tracking-wider">Biometric Comparison Canvas</div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative overflow-hidden p-4 rounded-lg bg-slate-950 border border-slate-850">
            {/* Document Image */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">ID DOCUMENT PHOTO</span>
              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={`${imagesBaseUrl}${selectedDoc.filename}`}
                  alt="Document"
                  className="w-full h-auto max-h-[220px] object-contain"
                />
              </div>
            </div>

            {/* Selfie Image */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono">LIVE CUSTOMER SELFIE</span>
              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={`${imagesBaseUrl}${selectedSelfie.filename}`}
                  alt="Selfie"
                  className="w-full h-auto max-h-[220px] object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Biometric Results Panel */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="glass rounded-lg p-6 flex-1 flex flex-col">
          <h2 className="text-base font-semibold text-white mb-2">Biometric Verification</h2>
          <p className="text-xs text-slate-400 mb-4">Results from face matching and liveness check</p>

          {error && (
            <div className="p-3 bg-red-955/40 border border-red-900 text-red-300 text-xs rounded-lg mb-4 font-mono">
              Error: {error}
            </div>
          )}

          {!matchResult && !isScanning && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-40">
              <p className="text-sm font-medium text-slate-400 font-mono">Awaiting scan</p>
              <p className="text-xs text-slate-500 mt-1">Select card & selfie, then run validation</p>
            </div>
          )}

          {isScanning && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/25 border-t-indigo-500 animate-spin mb-4" />
              <p className="text-sm text-indigo-300 font-medium animate-pulse">Running biometric match...</p>
            </div>
          )}

          {matchResult && !isScanning && (
            <div className="space-y-5 flex-1">
              {/* Decision Badge */}
              <div className={`p-4 rounded-lg text-center border ${
                matchResult.verified
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                  : 'bg-red-950/40 text-red-300 border-red-800/40'
              }`}>
                <div className="text-xl font-bold tracking-wider">
                  {matchResult.verified ? 'BIOMETRIC MATCH' : 'BIOMETRIC MISMATCH'}
                </div>
                <div className="text-[11px] opacity-80 mt-1">
                  {matchResult.verified ? 'Faces represent the same individual' : 'Faces do not match or spoof detected'}
                </div>
              </div>

              {/* Similarity Score */}
              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Facial Similarity Score</span>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-lg font-bold font-mono ${matchResult.verified ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(matchResult.score * 100).toFixed(2)}%
                  </span>
                  <span className="text-[11px] text-slate-550 font-mono">
                    Threshold: &gt;60%
                  </span>
                </div>
                <div className="h-1.5 rounded bg-slate-900 overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded ${matchResult.verified ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${matchResult.score * 100}%` }}
                  />
                </div>
              </div>

              {/* Cosine Distance */}
              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Cosine Distance Metric</span>
                <div className="text-sm font-bold font-mono mt-0.5 text-slate-300">
                  {matchResult.distance.toFixed(4)}
                </div>
              </div>

              {/* Rationale */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">Biometric Rationale</span>
                <p className="text-xs text-slate-350 leading-relaxed font-sans">
                  {matchResult.reason}
                </p>
              </div>

              {/* Model Info */}
              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Recognition Engine</span>
                <span className="text-xs font-semibold text-slate-400 font-mono mt-0.5 block">
                  {matchResult.detector}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

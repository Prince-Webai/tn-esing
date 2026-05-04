'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { frappeRequest } from '@/lib/frappe'
import { v4 as uuidv4 } from 'uuid'
import type { FieldPosition } from '@/types'

type Step = 'upload' | 'place' | 'send' | 'done'

interface PlacedField {
  id: string
  x: number
  y: number
  page: number
  width: number
  height: number
}

export default function UploadClient() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [fields, setFields] = useState<PlacedField[]>([])
  const [signerEmail, setSignerEmail] = useState('')
  const [projectNumber, setProjectNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPlacing, setIsPlacing] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<unknown>(null)
  const renderingRef = useRef(false)

  // Load pdfjs and render current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current || renderingRef.current) return
    renderingRef.current = true

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfDoc = pdfDocRef.current as any
      const page = await pdfDoc.getPage(pageNum)
      const scale = 1.4
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport }).promise
    } finally {
      renderingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (step === 'place' && pdfUrl) {
      const loadPdf = async () => {
        try {
          const pdfjsLib = await import('pdfjs-dist')
          // Aligning worker version with the API version 5.7.284
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.mjs`
          
          console.log('Loading PDF...');
          const doc = await pdfjsLib.getDocument(pdfUrl).promise
          pdfDocRef.current = doc
          setNumPages(doc.numPages)
          await renderPage(1)
          console.log('PDF Loaded successfully');
        } catch (err: any) {
          console.error('Error loading PDF:', err)
          setError('Failed to load PDF viewer. Please try again.')
        }
      }
      loadPdf()
    }
  }, [step, pdfUrl, renderPage])

  useEffect(() => {
    if (step === 'place') {
      renderPage(currentPage)
    }
  }, [currentPage, step, renderPage])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
    setFile(f)
    setError(null)
    const url = URL.createObjectURL(f)
    setPdfUrl(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
    setFile(f)
    setError(null)
    const url = URL.createObjectURL(f)
    setPdfUrl(url)
  }

  const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPlacing || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDrawStart({ x, y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawStart || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setCurrentRect({
      x: Math.min(drawStart.x, x),
      y: Math.min(drawStart.y, y),
      w: Math.abs(x - drawStart.x),
      h: Math.abs(y - drawStart.y)
    })
  }

  const handleMouseUp = () => {
    if (!drawStart || !currentRect || !canvasRef.current) {
      setDrawStart(null)
      setCurrentRect(null)
      return
    }

    const canvasW = canvasRef.current.width
    const canvasH = canvasRef.current.height

    const field: PlacedField = {
      id: uuidv4(),
      x: currentRect.x / canvasW,
      y: currentRect.y / canvasH,
      page: currentPage,
      width: currentRect.w / canvasW,
      height: currentRect.h / canvasH,
    }

    setFields((prev) => [...prev, field])
    setDrawStart(null)
    setCurrentRect(null)
    setIsPlacing(false)
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  const handleSend = async () => {
    if (!file || fields.length === 0) return
    setLoading(true)
    setError(null)

    try {
      // NEW: Google Drive Logic
      const driveFormData = new FormData()
      driveFormData.append('file', file)
      driveFormData.append('fields', JSON.stringify(fields))
      driveFormData.append('signerEmail', signerEmail)
      driveFormData.append('projectNumber', projectNumber)

      const uploadRes = await fetch('/api/drive/upload', {
        method: 'POST',
        body: driveFormData
      })

      if (!uploadRes.ok) {
        const errData = await uploadRes.json()
        throw new Error(errData.message || 'Failed to upload to Google Drive')
      }

      const driveData = await uploadRes.json()
      setShareLink(driveData.link)
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ─── Step: Upload ───────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
          <p className="text-gray-500 text-sm mt-1">Upload a PDF to place signature fields and send to a client</p>
        </div>

        {/* Stepper */}
        <Stepper current={0} />

        <div className="mt-8">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-orange-200 rounded-2xl p-14 text-center hover:border-orange-400 hover:bg-orange-50/50 transition cursor-pointer bg-white"
            onClick={() => document.getElementById('pdf-input')?.click()}
          >
            <input
              id="pdf-input"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            {file ? (
              <div>
                <p className="font-semibold text-gray-800 text-lg">{file.name}</p>
                <p className="text-sm text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Click to change</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-gray-700">Drop your PDF here or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">Supports PDF files only</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <button
            disabled={!file}
            onClick={() => setStep('place')}
            className="mt-6 w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl shadow hover:from-orange-600 hover:to-yellow-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next: Place Signature Field →
          </button>
        </div>
      </main>
    )
  }

  // ─── Step: Place ────────────────────────────────────────────────────────────
  if (step === 'place') {
    return (
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Place Signature Field</h1>
          <p className="text-gray-500 text-sm mt-1">Click "Add Field" then click on the PDF to place the signature box</p>
        </div>

        <Stepper current={1} />

        <div className="mt-6 flex gap-6">
          {/* Controls */}
          <div className="w-64 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">Controls</h3>

              <button
                onClick={() => setIsPlacing(true)}
                className={`w-full py-2.5 text-sm font-semibold rounded-xl transition ${
                  isPlacing
                    ? 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow hover:from-orange-600 hover:to-yellow-600'
                }`}
              >
                {isPlacing ? '🎯 Click on PDF...' : '+ Add Signature Field'}
              </button>

              {numPages > 1 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">Page</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >‹</button>
                    <span className="text-sm text-gray-700 flex-1 text-center">{currentPage} / {numPages}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                      disabled={currentPage === numPages}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                    >›</button>
                  </div>
                </div>
              )}
            </div>

            {/* Placed fields list */}
            {fields.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">
                  Placed Fields ({fields.length})
                </h3>
                <div className="space-y-2">
                  {fields.map((f, i) => (
                    <div key={f.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2">
                      <span className="text-xs text-orange-700 font-medium">Field {i + 1} · Page {f.page}</span>
                      <button
                        onClick={() => removeField(f.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setStep('upload')}
                className="w-full py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                disabled={fields.length === 0}
                onClick={() => setStep('send')}
                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-semibold rounded-xl shadow hover:from-orange-600 hover:to-yellow-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next: Send →
              </button>
            </div>
          </div>

          {/* PDF viewer */}
          <div className="flex-1 overflow-auto">
            <div
              ref={containerRef}
              className={`relative inline-block ${isPlacing ? 'cursor-crosshair' : 'cursor-default'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <canvas ref={canvasRef} className="shadow-xl rounded-lg border border-gray-200" />

              {/* Render current drawing preview */}
              {currentRect && (
                <div
                  className="absolute border-2 border-orange-500 bg-orange-500/20 pointer-events-none"
                  style={{
                    left: currentRect.x,
                    top: currentRect.y,
                    width: currentRect.w,
                    height: currentRect.h,
                  }}
                />
              )}

              {/* Render placed fields for current page */}
              {canvasRef.current && fields
                .filter((f) => f.page === currentPage)
                .map((f) => {
                  const cw = canvasRef.current!.width
                  const ch = canvasRef.current!.height
                  return (
                    <div
                      key={f.id}
                      className="signature-field"
                      style={{
                        left: f.x * cw,
                        top: f.y * ch,
                        width: f.width * cw,
                        height: f.height * ch,
                      }}
                    >
                      <span className="signature-field-label">✍ Signature</span>
                      <button
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-10"
                        onClick={(e) => { e.stopPropagation(); removeField(f.id) }}
                      >×</button>
                    </div>
                  )
                })}

              {isPlacing && !drawStart && (
                <div className="absolute inset-0 bg-orange-500/5 rounded-lg border-2 border-orange-400 border-dashed pointer-events-none flex items-center justify-center">
                  <div className="bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow">
                    Drag to draw signature field
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ─── Step: Send ─────────────────────────────────────────────────────────────
  if (step === 'send') {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Send for Signing</h1>
          <p className="text-gray-500 text-sm mt-1">Optionally add the client&apos;s email, then generate a signing link</p>
        </div>

        <Stepper current={2} />

        <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Project Number <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                required
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                placeholder="e.g. PN-2024-001"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Client Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Document</span>
              <span className="font-medium text-gray-800 truncate ml-4 max-w-[240px]">{file?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Signature fields</span>
              <span className="font-medium text-gray-800">{fields.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pages with fields</span>
              <span className="font-medium text-gray-800">
                {[...new Set(fields.map((f) => f.page))].join(', ')}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('place')}
              className="flex-1 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleSend}
              disabled={loading}
              className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-semibold rounded-xl shadow hover:from-orange-600 hover:to-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Generate Signing Link →'
              )}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ─── Step: Done ─────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Document Sent!</h2>
        <p className="text-gray-500 text-sm mb-6">Share this link with your client to collect their signature</p>

        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <span className="flex-1 text-sm text-gray-700 truncate text-left">{shareLink}</span>
          <button
            onClick={copyLink}
            className="flex-shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-800 transition"
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setStep('upload')
              setFile(null)
              setPdfUrl(null)
              setFields([])
              setShareLink(null)
              setSignerEmail('')
            }}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Upload another
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-semibold rounded-xl shadow hover:from-orange-600 hover:to-yellow-600 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </main>
  )
}

function Stepper({ current }: { current: number }) {
  const steps = ['Upload PDF', 'Place Fields', 'Send']
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 ${i <= current ? 'text-orange-600' : 'text-gray-400'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              i < current ? 'bg-orange-500 text-white' :
              i === current ? 'bg-orange-100 text-orange-600 border-2 border-orange-400' :
              'bg-gray-100 text-gray-400'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className="text-sm font-medium hidden sm:block">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 ${i < current ? 'bg-orange-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

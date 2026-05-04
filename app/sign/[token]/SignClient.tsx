'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import type { FieldPosition } from '@/types'

interface Props {
  token: string
  documentUrl: string
  documentName: string
  documentId: string
  requestId: string
  fieldPosition: FieldPosition
}

export default function SignClient({
  token,
  documentUrl,
  documentName,
  requestId,
  fieldPosition,
}: Props) {
  const sigPadRef = useRef<SignatureCanvas>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sigContainerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<unknown>(null)
  const renderingRef = useRef(false)

  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(fieldPosition.page || 1)
  const [showSignPad, setShowSignPad] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [sigPadSize, setSigPadSize] = useState({ width: 500, height: 250 })

  // Handle window resize for PDF scaling
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle signature pad responsiveness
  useEffect(() => {
    if (showSignPad && sigContainerRef.current) {
      const { width } = sigContainerRef.current.getBoundingClientRect()
      setSigPadSize({ width: width - 4, height: Math.min(300, window.innerHeight * 0.4) })
    }
  }, [showSignPad])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current || renderingRef.current) return
    renderingRef.current = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = pdfDocRef.current as any
      const page = await doc.getPage(pageNum)
      
      const maxWidth = Math.min(windowWidth - 32, 850)
      const unscaledViewport = page.getViewport({ scale: 1.0 })
      const dynamicScale = maxWidth / unscaledViewport.width
      
      const viewport = page.getViewport({ scale: dynamicScale })
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      setCanvasSize({ width: viewport.width, height: viewport.height })
      await page.render({ canvasContext: ctx, viewport }).promise
    } finally {
      renderingRef.current = false
    }
  }, [windowWidth])

  useEffect(() => {
    const load = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        const doc = await pdfjsLib.getDocument({
          url: documentUrl,
          withCredentials: true
        }).promise
        pdfDocRef.current = doc
        setNumPages(doc.numPages)
        await renderPage(fieldPosition.page || 1)
      } catch (err: any) {
        setError(`Error loading PDF viewer`)
      }
    }
    load()
  }, [documentUrl, fieldPosition.page, renderPage])

  useEffect(() => {
    renderPage(currentPage)
  }, [currentPage, renderPage])

  const handleFieldClick = () => {
    if (currentPage === fieldPosition.page) {
      setShowSignPad(true)
    } else {
      setCurrentPage(fieldPosition.page)
      setTimeout(() => setShowSignPad(true), 400)
    }
  }

  const clearSig = () => sigPadRef.current?.clear()

  const handleSubmit = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setError('Please draw your signature before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const signatureDataUrl = sigPadRef.current.toDataURL('image/png')

      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          requestId,
          signatureDataUrl,
          fieldPosition,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save signature')
      }

      setShowSignPad(false)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-sm w-full border border-gray-100">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Signed!</h1>
          <p className="text-gray-500 text-sm mb-8">
            Your document has been securely saved to Google Drive.
          </p>
          <div className="px-6 py-3 bg-gray-50 rounded-2xl text-[10px] text-gray-400 font-bold uppercase tracking-widest border border-gray-100">
            ID: {token.slice(0, 8)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-200">
              <span className="text-white font-black text-xs">TN</span>
            </div>
            <span className="font-black text-gray-900 text-sm uppercase tracking-tighter hidden xs:inline">Solar Sign</span>
          </div>
          <button
            onClick={() => setShowSignPad(true)}
            className="bg-orange-600 text-white px-6 py-2.5 rounded-full font-black text-xs hover:bg-orange-700 active:scale-95 transition shadow-lg shadow-orange-200"
          >
            SIGN DOCUMENT ✍
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 sm:py-8 flex flex-col gap-4">
        {/* Instruction Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 flex-shrink-0">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
               <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
             </svg>
          </div>
          <div>
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">Review & Sign</h3>
            <p className="text-[11px] text-gray-400 font-bold leading-tight uppercase tracking-wide mt-0.5">
               Tap the orange box or use the "Sign" button above
            </p>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-200 overflow-hidden relative flex-1 flex flex-col min-h-0">
          <div className="absolute top-4 right-4 z-10 bg-black/80 text-white px-4 py-1.5 rounded-full text-[10px] font-black backdrop-blur-xl border border-white/20">
            {currentPage} / {numPages}
          </div>

          <div className="flex-1 overflow-auto bg-gray-500 p-2 sm:p-8 flex justify-center scroll-smooth">
            <div className="relative inline-block shadow-2xl h-fit">
              <canvas ref={canvasRef} className="bg-white rounded-sm" />

              {/* Signature field overlay */}
              {currentPage === fieldPosition.page && canvasSize.width > 0 && (
                <div
                  className="absolute cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  style={{
                    left: fieldPosition.x * canvasSize.width,
                    top: fieldPosition.y * canvasSize.height,
                    width: fieldPosition.width * canvasSize.width,
                    height: fieldPosition.height * canvasSize.height,
                    background: 'rgba(234, 88, 12, 0.15)',
                    border: '3px solid #ea580c',
                    borderRadius: '4px',
                    boxShadow: '0 0 15px rgba(234, 88, 12, 0.3)'
                  }}
                  onClick={handleFieldClick}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-orange-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-xl uppercase tracking-tighter whitespace-nowrap">
                       SIGN HERE
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nav Controls */}
          <div className="bg-white border-t border-gray-100 p-4 flex items-center justify-between shrink-0">
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center font-black text-gray-400 hover:bg-gray-100 disabled:opacity-20 transition-all"
              >←</button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
                className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center font-black text-gray-400 hover:bg-gray-100 disabled:opacity-20 transition-all"
              >→</button>
            </div>
            
            {currentPage !== fieldPosition.page && (
              <button
                onClick={() => setCurrentPage(fieldPosition.page)}
                className="text-[10px] font-black text-orange-600 uppercase tracking-widest bg-orange-50 px-5 py-3 rounded-2xl hover:bg-orange-100 transition-all active:scale-95"
              >
                Go to Sign Page
              </button>
            )}
          </div>
        </div>
      </main>

      {/* FULL-SCREEN MOBILE MODAL */}
      {showSignPad && (
        <div className="fixed inset-0 bg-white sm:bg-gray-900/90 sm:backdrop-blur-xl flex flex-col z-[100] animate-in slide-in-from-bottom duration-500">
          <div className="p-6 flex items-center justify-between border-b border-gray-100 bg-white">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Your Signature</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-0.5">Please draw clearly</p>
            </div>
            <button onClick={() => setShowSignPad(false)} className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-all">
              <span className="text-xl font-bold">✕</span>
            </button>
          </div>

          <div className="flex-1 p-6 flex flex-col bg-white">
            <div 
              ref={sigContainerRef}
              className="flex-1 bg-gray-50 rounded-[2.5rem] border-4 border-dashed border-gray-200 relative overflow-hidden flex items-center justify-center shadow-inner"
            >
               <SignatureCanvas
                  ref={sigPadRef}
                  penColor="#000000"
                  canvasProps={{
                    width: sigPadSize.width,
                    height: sigPadSize.height,
                    className: 'signature-canvas',
                    style: { touchAction: 'none' }
                  }}
                />
               <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-gray-300 font-black uppercase tracking-widest pointer-events-none opacity-50">
                  Signature Box
               </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button onClick={clearSig} className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl transition">
                 Clear Signature
              </button>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 text-red-600 rounded-2xl px-6 py-4 text-[11px] font-black border border-red-100 animate-bounce">
                ⚠️ {error}
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-6 bg-orange-600 text-white text-lg font-black rounded-3xl shadow-2xl shadow-orange-900/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {submitting ? 'SAVING TO DRIVE...' : 'FINISH & SIGN ✓'}
              </button>
              <button
                onClick={() => setShowSignPad(false)}
                className="w-full py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest rounded-2xl hover:text-gray-600 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

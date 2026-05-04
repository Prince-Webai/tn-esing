'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import type { FieldPosition } from '@/types'

interface Props {
  documentUrl: string
  signatureImageUrl?: string
  fieldPosition?: FieldPosition
  status: string
}

export default function DocumentViewer({ documentUrl, signatureImageUrl, fieldPosition, status }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<unknown>(null)
  const renderingRef = useRef(false)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current || renderingRef.current) return
    renderingRef.current = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = pdfDocRef.current as any
      const page = await doc.getPage(pageNum)
      const scale = 1.4
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      setCanvasSize({ width: viewport.width, height: viewport.height })
      await page.render({ canvasContext: ctx, viewport }).promise

      // Overlay signature if on the right page
      if (status === 'signed' && signatureImageUrl && fieldPosition && fieldPosition.page === pageNum) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = signatureImageUrl
        img.onload = () => {
          const x = fieldPosition.x * viewport.width
          const y = fieldPosition.y * viewport.height
          const w = fieldPosition.width * viewport.width
          const h = fieldPosition.height * viewport.height
          ctx.drawImage(img, x, y, w, h)
        }
      }
    } finally {
      renderingRef.current = false
    }
  }, [signatureImageUrl, fieldPosition, status])

  useEffect(() => {
    const load = async () => {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
      const doc = await pdfjsLib.getDocument(documentUrl).promise
      pdfDocRef.current = doc
      setNumPages(doc.numPages)
      await renderPage(1)
    }
    load()
  }, [documentUrl, renderPage])

  useEffect(() => {
    renderPage(currentPage)
  }, [currentPage, renderPage])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Document Preview</h2>
      <div className="overflow-auto bg-gray-100 rounded-xl p-4">
        <div className="relative inline-block mx-auto">
          <canvas ref={canvasRef} className="shadow-xl rounded-lg border border-gray-200 block" />

          {/* Show signature field outline on non-signed docs */}
          {status === 'pending' && fieldPosition && currentPage === fieldPosition.page && canvasSize.width > 0 && (
            <div
              className="absolute border-2 border-dashed border-orange-300 bg-orange-50/30 rounded"
              style={{
                left: fieldPosition.x * canvasSize.width,
                top: fieldPosition.y * canvasSize.height,
                width: fieldPosition.width * canvasSize.width,
                height: fieldPosition.height * canvasSize.height,
              }}
            />
          )}
        </div>
      </div>

      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >← Prev</button>
          <span className="text-sm text-gray-600">Page {currentPage} of {numPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage === numPages}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >Next →</button>
        </div>
      )}
    </div>
  )
}

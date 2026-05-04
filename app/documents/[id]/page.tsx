import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentViewer from './DocumentViewer'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, signature_requests(*)')
    .eq('id', id)
    .single()

  if (error || !doc) notFound()

  const request = doc.signature_requests?.[0]

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-gray-400 hover:text-orange-500 transition">Dashboard</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium truncate max-w-[300px]">{doc.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 truncate max-w-[400px]">{doc.name}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Uploaded {new Date(doc.created_at).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {doc.status === 'signed' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-semibold rounded-full border border-green-100">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                Signed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-sm font-semibold rounded-full border border-orange-100">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                </svg>
                Awaiting Signature
              </span>
            )}

            {/* Download button */}
            {doc.status === 'signed' && (doc.signed_storage_url || doc.storage_url) && (
              <a
                href={doc.signed_storage_url || doc.storage_url}
                download={`signed_${doc.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition shadow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Signed PDF
              </a>
            )}

            {/* Copy link for pending */}
            {doc.status === 'pending' && request && (
              <a
                href={`/sign/${request.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 text-sm font-semibold rounded-xl hover:bg-orange-50 transition"
              >
                View Signing Page ↗
              </a>
            )}
          </div>
        </div>

        {/* Details card */}
        {request && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Signing Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 font-medium">Signer Email</p>
                <p className="text-sm text-gray-800 mt-0.5">{request.signer_email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Status</p>
                <p className="text-sm text-gray-800 mt-0.5 capitalize">{doc.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Signed At</p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {request.signed_at
                    ? new Date(request.signed_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PDF Viewer */}
        <DocumentViewer
          documentUrl={doc.signed_storage_url || doc.storage_url}
          signatureImageUrl={request?.signature_image_url}
          fieldPosition={request?.field_position}
          status={doc.status}
        />
      </main>
    </div>
  )
}

import { getMetadataFromDrive } from '@/lib/drive'
import SignClient from './SignClient'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SignPage({ params }: Props) {
  const { token } = await params

  /* 
  // LEGACY: Supabase logic preserved
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: request, error } = await supabase
    .from('signature_requests')
    .select('*, documents(*)')
    .eq('token', token)
    .single()

  if (error || !request) {
    notFound()
  }
  */

  // NEW: Google Drive Logic
  let request: any;
  try {
    request = await getMetadataFromDrive(token);
  } catch (err) {
    console.error('Drive Metadata Error:', err);
    notFound();
  }

  if (request.status === 'signed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-yellow-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md w-full border border-gray-100">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Already Signed</h1>
          <p className="text-gray-500 text-sm">
            This document was signed on{' '}
            {new Date(request.signed_at).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
          <div className="mt-6 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-600">
            <strong>{request.original_file_name}</strong>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SignClient
      token={token}
      documentUrl={`/api/drive/file/${request.drive_file_id}`}
      documentName={request.original_file_name}
      documentId={request.drive_file_id}
      requestId={token}
      fieldPosition={Array.isArray(request.fields) ? request.fields[0] : request.fields}
    />
  )
}

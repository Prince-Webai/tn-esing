import Link from 'next/link'
import Navbar from '@/components/Navbar'
import CopyLinkButton from '@/components/CopyLinkButton'
import { listRequestsFromDrive } from '@/lib/drive'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const sid = cookieStore.get('sid')?.value

  if (!sid) {
    redirect('/login')
  }

  let docs: any[] = []
  let error = null

  try {
    docs = await listRequestsFromDrive()
  } catch (e) {
    console.error('Dashboard Load Error:', e)
    error = 'Failed to load documents from Google Drive'
  }

  const pending = docs.filter((d) => d.status === 'pending').length
  const signed = docs.filter((d) => d.status === 'signed').length

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">DOCUMENT DASHBOARD</h1>
            <p className="text-gray-500 text-sm mt-1 uppercase tracking-widest font-bold">Managed via Google Drive</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-200 hover:bg-orange-700 active:scale-95 transition text-sm uppercase tracking-tight"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Upload New PDF
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Files</p>
            <p className="text-4xl font-black text-gray-900 mt-1">{docs.length}</p>
          </div>
          <div className="bg-white rounded-3xl border-l-4 border-l-orange-500 border-gray-100 shadow-sm p-6">
            <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">Pending</p>
            <p className="text-4xl font-black text-gray-900 mt-1">{pending}</p>
          </div>
          <div className="bg-white rounded-3xl border-l-4 border-l-green-500 border-gray-100 shadow-sm p-6">
            <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Signed</p>
            <p className="text-4xl font-black text-gray-900 mt-1">{signed}</p>
          </div>
        </div>

        {/* Documents list */}
        {error ? (
          <div className="bg-red-50 text-red-600 rounded-2xl px-6 py-4 text-sm font-bold border border-red-100">
            ⚠️ {error}
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-20 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-black text-xl uppercase tracking-tight">Your Drive is Empty</h3>
            <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">Upload a document to start collecting signatures securely on Google Drive.</p>
            <Link
              href="/upload"
              className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-2xl hover:bg-black transition"
            >
              Get Started
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="bg-gray-50 border-b border-gray-100">
                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document</th>
                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</th>
                     <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                   {docs.map((doc) => (
                     <tr key={doc.token} className="hover:bg-gray-50/50 transition">
                       <td className="px-6 py-5">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 flex-shrink-0">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                           </div>
                           <div>
                             <p className="text-sm font-black text-gray-900 truncate max-w-[200px]">{doc.original_file_name}</p>
                             <div className="flex items-center gap-2 mt-0.5">
                               <span className="text-[9px] bg-orange-50 text-orange-600 font-black px-2 py-0.5 rounded uppercase tracking-tighter border border-orange-100">
                                 {doc.project_number || 'General'}
                               </span>
                               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                 {new Date(doc.created_at).toLocaleDateString()}
                               </span>
                             </div>
                           </div>
                         </div>
                       </td>
                       <td className="px-6 py-5">
                         {doc.status === 'signed' ? (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-tight">
                             <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                             Signed
                           </span>
                         ) : (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black uppercase tracking-tight">
                             <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                             Pending
                           </span>
                         )}
                       </td>
                       <td className="px-6 py-5 text-sm text-gray-500 font-medium">
                         {doc.signer_email || 'No email provided'}
                       </td>
                       <td className="px-6 py-5">
                         <div className="flex items-center gap-3">
                           {doc.status === 'signed' ? (
                             <a
                               href={doc.signed_drive_link}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="text-xs font-black text-green-600 hover:text-green-800 uppercase tracking-widest flex items-center gap-1"
                             >
                               View PDF
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                             </a>
                           ) : (
                             <>
                               <CopyLinkButton link={`${process.env.NEXT_PUBLIC_APP_URL}/sign/${doc.token}`} />
                               <Link
                                 href={`/sign/${doc.token}`}
                                 className="text-xs font-black text-orange-600 hover:text-orange-800 uppercase tracking-widest"
                               >
                                 Preview
                               </Link>
                             </>
                           )}
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </main>
    </div>
  )
}

import Navbar from '@/components/Navbar'
import UploadClient from './UploadClient'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function UploadPage() {
  const cookieStore = await cookies()
  const sid = cookieStore.get('sid')?.value

  if (!sid) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <UploadClient />
    </div>
  )
}

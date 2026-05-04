import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_FRAPPE_URL
    const apiKey = process.env.FRAPPE_API_KEY
    const apiSecret = process.env.FRAPPE_API_SECRET

    // Re-create the form data for Frappe
    const frappeFormData = new FormData()
    frappeFormData.append('file', file)
    frappeFormData.append('is_private', '0')
    frappeFormData.append('folder', 'Home/Attachments')

    console.log('Sending file to Frappe:', file.name)
    const response = await fetch(`${baseUrl}/api/method/upload_file`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${apiKey}:${apiSecret}`
      },
      body: frappeFormData
    })

    const data = await response.json()
    console.log('Frappe Response Status:', response.status)
    
    if (!response.ok) {
      console.error('Frappe Upload Error Detail:', JSON.stringify(data, null, 2))
      throw new Error(data.message || 'Failed to upload to Frappe')
    }

    console.log('Frappe Upload Success:', data.message.file_url)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Server Upload Error:', error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

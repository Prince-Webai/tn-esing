import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const searchParams = req.nextUrl.searchParams.toString()
  const baseUrl = process.env.NEXT_PUBLIC_FRAPPE_URL
  const apiKey = process.env.FRAPPE_API_KEY
  const apiSecret = process.env.FRAPPE_API_SECRET

  if (!baseUrl) {
    return NextResponse.json({ message: 'NEXT_PUBLIC_FRAPPE_URL is not configured' }, { status: 500 })
  }

  const url = `${baseUrl}/api/${path}${searchParams ? '?' + searchParams : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${apiKey}:${apiSecret}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': req.headers.get('cookie') || ''
      }
    })

    const contentType = response.headers.get('content-type') || ''
    let data: any
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = { message: text.slice(0, 500) }
    }

    const res = NextResponse.json(data, { status: response.status })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      res.headers.set('set-cookie', setCookie)
    }
    return res
  } catch (error: any) {
    return NextResponse.json({ message: `Proxy error: ${error.message}`, url }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const baseUrl = process.env.NEXT_PUBLIC_FRAPPE_URL
  const apiKey = process.env.FRAPPE_API_KEY
  const apiSecret = process.env.FRAPPE_API_SECRET

  if (!baseUrl) {
    return NextResponse.json({ message: 'NEXT_PUBLIC_FRAPPE_URL is not configured' }, { status: 500 })
  }

  const url = `${baseUrl}/api/${path}`

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${apiKey}:${apiSecret}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': req.headers.get('cookie') || ''
      },
      body: JSON.stringify(body)
    })

    const contentType = response.headers.get('content-type') || ''
    let data: any
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = { message: text.slice(0, 500) }
    }

    const res = NextResponse.json(data, { status: response.status })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      res.headers.set('set-cookie', setCookie)
    }
    return res
  } catch (error: any) {
    return NextResponse.json({ message: `Proxy error: ${error.message}`, url }, { status: 500 })
  }
}

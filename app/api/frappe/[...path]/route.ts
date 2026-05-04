import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const searchParams = req.nextUrl.searchParams.toString()
  const baseUrl = process.env.NEXT_PUBLIC_FRAPPE_URL
  const apiKey = process.env.FRAPPE_API_KEY
  const apiSecret = process.env.FRAPPE_API_SECRET

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

    const data = await response.json()
    const res = NextResponse.json(data, { status: response.status })

    // Forward Set-Cookie headers from Frappe to the browser
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      res.headers.set('set-cookie', setCookie)
    }

    return res
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const baseUrl = process.env.NEXT_PUBLIC_FRAPPE_URL
  const apiKey = process.env.FRAPPE_API_KEY
  const apiSecret = process.env.FRAPPE_API_SECRET
  const body = await req.json()

  const url = `${baseUrl}/api/${path}`

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

    const data = await response.json()
    const res = NextResponse.json(data, { status: response.status })

    // Forward Set-Cookie headers from Frappe to the browser
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      res.headers.set('set-cookie', setCookie)
    }

    return res
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

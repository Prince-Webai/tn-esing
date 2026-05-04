'use client'

import { useState } from 'react'

type Props = {
  link?: string
  token?: string
}

export default function CopyLinkButton({ link, token }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const url = link ?? (token ? `${window.location.origin}/sign/${token}` : '')
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition"
    >
      {copied ? '✓ Copied!' : 'Copy link'}
    </button>
  )
}

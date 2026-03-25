'use client'

import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  loading?: boolean
}

export default function UploadDropzone({ onFile, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.xlsx')) onFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
        ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
        ${loading ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
      <div className="text-4xl mb-3">📊</div>
      <p className="text-sm font-medium text-gray-700">
        {loading ? '解析中…' : '拖放 xlsx 檔案至此，或點擊選擇'}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        學員關懷傘下學員報課狀況.xlsx
      </p>
    </div>
  )
}

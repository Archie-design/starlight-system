'use client'

import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  loading?: boolean
}

export default function UploadDropzone({ onFile, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const accept = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setFileError(`僅接受 .xlsx 檔案（你選擇的是「${file.name}」）`)
      return
    }
    setFileError(null)
    onFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    accept(e.dataTransfer.files[0])
  }

  const open = () => { if (!loading) inputRef.current?.click() }

  return (
    <div>
      <div
        role="button"
        tabIndex={loading ? -1 : 0}
        aria-label="上傳 xlsx 檔案：拖放或按 Enter 選擇檔案"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
        }}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          ${loading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
        <div className="text-4xl mb-3">📊</div>
        <p className="text-sm font-medium text-gray-700">
          {loading ? '解析中…' : '拖放 xlsx 檔案至此，或點擊選擇'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          學員資料庫.xlsx
        </p>
      </div>

      {fileError && (
        <p role="alert" className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
          {fileError}
        </p>
      )}
    </div>
  )
}

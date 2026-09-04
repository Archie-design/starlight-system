'use client'

import { useEffect, useState } from 'react'
import { subscribe, toast, type ToastItem } from '@/lib/toast'

const VARIANT_STYLES: Record<ToastItem['variant'], string> = {
  error: 'bg-red-600 text-white',
  success: 'bg-emerald-600 text-white',
  info: 'bg-slate-800 text-white',
}

const VARIANT_ICON: Record<ToastItem['variant'], string> = {
  error: '⚠',
  success: '✓',
  info: 'ℹ',
}

/**
 * 掛載一次於 app/layout.tsx，全站共用。訂閱 lib/toast.ts 的模組級 store，
 * 任何地方呼叫 toast.error()/toast.success() 都會在這裡顯示——取代原本
 * 散落各處的 alert()。z-[100] 高於既有 Modal 的 z-50，確保 Modal 開啟中
 * 觸發的錯誤訊息仍然可見。
 */
export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => subscribe(setItems), [])

  if (items.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.variant === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm ${VARIANT_STYLES[item.variant]}`}
        >
          <span aria-hidden="true" className="font-bold leading-5">{VARIANT_ICON[item.variant]}</span>
          <p className="flex-1 leading-5">{item.message}</p>
          <button
            type="button"
            onClick={() => toast.dismiss(item.id)}
            aria-label="關閉提示"
            className="opacity-70 hover:opacity-100 transition-opacity leading-5"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

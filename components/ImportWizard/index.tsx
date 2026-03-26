'use client'

import { useState, useEffect, useRef } from 'react'
import { useStudentStore } from '@/store/useStudentStore'
import UploadDropzone from './UploadDropzone'
import DiffTable from './DiffTable'
import type { ImportPreviewResult } from '@/lib/supabase/types'

type Step = 'upload' | 'preview' | 'applying' | 'done'

export default function ImportWizard() {
  const { importModalOpen, setImportModalOpen } = useStudentStore()
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [result, setResult] = useState<{ applied: number; errors: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applyProgress, setApplyProgress] = useState(0)
  const applyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step === 'applying') {
      setApplyProgress(0)
      applyTimerRef.current = setInterval(() => {
        setApplyProgress(p => {
          if (p >= 90) { clearInterval(applyTimerRef.current!); return 90 }
          return p + 1
        })
      }, 150)
    } else {
      if (applyTimerRef.current) clearInterval(applyTimerRef.current)
      if (step === 'done') setApplyProgress(100)
    }
    return () => { if (applyTimerRef.current) clearInterval(applyTimerRef.current) }
  }, [step])

  if (!importModalOpen) return null

  const close = () => {
    setImportModalOpen(false)
    setStep('upload')
    setPreview(null)
    setResult(null)
    setError(null)
  }

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!preview) return
    setStep('applying')
    setError(null)
    try {
      const res = await fetch('/api/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: preview.session_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '套用失敗')
      setStep('preview')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {step === 'upload' && '匯入學員資料'}
            {step === 'preview' && '預覽變更'}
            {step === 'applying' && '套用中…'}
            {step === 'done' && '匯入完成'}
          </h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <>
              <UploadDropzone onFile={handleFile} loading={loading} />
              {error && (
                <p className="mt-3 text-sm text-red-500 text-center">{error}</p>
              )}
            </>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <>
              {/* 統計 */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: '來源資料列', value: preview.stats.total_source_rows },
                  { label: '比對到學員', value: preview.stats.matched, color: 'text-blue-600' },
                  { label: '欄位變更', value: preview.stats.total_changes, color: 'text-yellow-600' },
                  { label: '新學員', value: preview.stats.new_students, color: 'text-green-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3 text-center border">
                    <div className={`text-2xl font-bold ${color ?? ''}`}>{value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* 新學員列表 */}
              {preview.new_student_names.length > 0 && (
                <div className="mb-3 p-3 bg-green-50 rounded border border-green-200 text-sm">
                  <span className="font-medium text-green-700">新學員 ({preview.new_student_names.length})：</span>
                  <span className="text-green-600 ml-1">
                    {preview.new_student_names.slice(0, 20).join('、')}
                    {preview.new_student_names.length > 20 && `…等 ${preview.new_student_names.length} 人`}
                  </span>
                </div>
              )}

              {/* 差異表格 */}
              <DiffTable changes={preview.changes} />
              {preview.stats.total_changes > 1000 && (
                <p className="text-xs text-gray-400 mt-1 text-right">
                  僅顯示前 1,000 筆變更，實際共 {preview.stats.total_changes} 筆
                </p>
              )}

              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </>
          )}

          {/* Step 3: Applying */}
          {step === 'applying' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5 px-8">
              <p className="text-gray-700 font-medium">套用變更中，請稍候…</p>
              <div className="w-full max-w-sm">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>正在寫入資料庫</span>
                  <span className="tabular-nums">{applyProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-150"
                    style={{ width: `${applyProgress}%` }}
                  />
                </div>
                {preview && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    共 {preview.stats.total_source_rows.toLocaleString()} 筆資料・請勿關閉視窗
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="text-5xl">✅</div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-800">匯入完成</p>
                <p className="text-sm text-gray-500 mt-1">
                  已更新 {result.applied} 位學員資料
                  {result.errors > 0 && (
                    <span className="text-red-500 ml-2">（{result.errors} 筆失敗）</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-3 border-t bg-gray-50">
          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                ← 重新上傳
              </button>
              <button
                onClick={handleApply}
                disabled={preview?.stats.total_changes === 0}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                套用 {preview?.stats.total_changes} 筆變更
              </button>
            </>
          )}
          {(step === 'done' || step === 'upload') && (
            <button
              onClick={close}
              className="px-5 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              關閉
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

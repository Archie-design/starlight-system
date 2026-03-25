'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'

interface ImportSession {
  id: string
  imported_at: string
  filename: string | null
  source_rows: number | null
  rows_updated: number
  rows_inserted: number
  rows_unchanged: number
  applied: boolean
  applied_at: string | null
}

interface ImportLog {
  id: string
  student_id: number
  student_name: string | null
  field: string
  old_value: string | null
  new_value: string | null
  change_type: 'insert' | 'update'
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const FIELD_LABELS: Record<string, string> = {
  name: '姓名', gender: '性別', role: '角色', phone: '手機', line_id: 'LINE ID',
  introducer: '介紹人', counselor: '輔導員', region: '地區', sheet_system: '體系',
  membership_expiry: '會員到期', course_1: '一階課程', payment_1: '一階繳費',
  course_2: '二階課程', payment_2: '二階繳費', course_3: '三階課程', payment_3: '三階繳費',
  course_4: '四階課程', payment_4: '四階繳費', course_5: '五階課程', payment_5: '五階繳費',
  course_wuyun: '五運課程', payment_wuyun: '五運繳費',
  life_numbers: '生命數字', life_numbers_advanced: '生命數字進階',
  life_transform: '生命轉化', debt_release: '債務釋放',
}

function fmt(v: string | null) {
  return v ?? <span className="text-slate-300 italic">空</span>
}

function LogTable({ sessionId }: { sessionId: string }) {
  const [nameFilter, setNameFilter] = useState('')
  const { data, isLoading } = useSWR<{ logs: ImportLog[] }>(
    `/api/history/${sessionId}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const logs = data?.logs ?? []
  const filtered = nameFilter
    ? logs.filter(l => l.student_name?.includes(nameFilter))
    : logs

  // 依學員分組
  const groups = new Map<string, ImportLog[]>()
  for (const log of filtered) {
    const key = `${log.student_id}_${log.student_name ?? ''}`
    const arr = groups.get(key) ?? []
    arr.push(log)
    groups.set(key, arr)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
        <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        載入變更明細…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-3">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="搜尋姓名…"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="border border-slate-300 rounded pl-6 pr-2 py-1 text-xs w-36 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          共 <span className="font-semibold text-slate-700">{logs.length.toLocaleString()}</span> 筆變更
          ・<span className="font-semibold text-slate-700">{groups.size}</span> 位學員
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {groups.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <span className="text-3xl">📭</span>
            <p>{logs.length === 0 ? '此次匯入無變更紀錄' : '找不到符合的學員'}</p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([key, entries]) => {
            const [, studentName] = key.split('_')
            const studentId = entries[0].student_id
            const isInsert = entries[0].change_type === 'insert'
            return (
              <div key={key} className="border-b border-slate-100">
                {/* 學員標題 */}
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-700">{studentName ?? '（無名稱）'}</span>
                  <span className="text-[10px] text-slate-400">#{studentId}</span>
                  {isInsert ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">新增</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">更新 {entries.length} 欄</span>
                  )}
                </div>
                {/* 欄位變更 */}
                <table className="w-full text-xs">
                  <tbody>
                    {entries.map(log => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                        <td className="px-4 py-1 text-slate-500 w-28 whitespace-nowrap">
                          {FIELD_LABELS[log.field] ?? log.field}
                        </td>
                        <td className="px-2 py-1 text-slate-400 w-6 text-center">→</td>
                        {log.change_type === 'update' ? (
                          <>
                            <td className="px-2 py-1 text-slate-400 line-through w-40 truncate max-w-[160px]">
                              {fmt(log.old_value)}
                            </td>
                            <td className="px-2 py-1 text-slate-300 w-4">→</td>
                            <td className="px-2 py-1 text-slate-800 font-medium truncate max-w-[200px]">
                              {fmt(log.new_value)}
                            </td>
                          </>
                        ) : (
                          <td colSpan={3} className="px-2 py-1 text-slate-800 font-medium truncate max-w-[300px]">
                            {fmt(log.new_value)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function HistoryClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data, isLoading } = useSWR<{ sessions: ImportSession[] }>(
    '/api/history',
    fetcher,
    { revalidateOnFocus: false }
  )

  const sessions = data?.sessions ?? []

  function fmtDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 頭部 */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-blue-800 text-white shadow-md flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-yellow-300 text-lg leading-none">★</span>
          <h1 className="text-sm font-semibold tracking-wider text-white/95">匯入紀錄</h1>
        </div>
        <Link
          href="/students"
          className="text-xs text-blue-200 hover:text-white transition-colors"
        >
          ← 返回學員表格
        </Link>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* 左：session 列表 */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
            匯入批次
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-xs gap-1.5">
                <span className="inline-block w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                載入中…
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-xs">尚無匯入紀錄</div>
            ) : (
              sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-100 transition-colors hover:bg-blue-50 ${
                    selectedId === s.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                  }`}
                >
                  <div className="text-xs font-medium text-slate-700 truncate">
                    {s.filename ?? '（未知檔案）'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(s.imported_at)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {s.rows_inserted > 0 && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 text-green-700">
                        +{s.rows_inserted} 新增
                      </span>
                    )}
                    {s.rows_updated > 0 && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">
                        ↻{s.rows_updated} 更新
                      </span>
                    )}
                    {s.rows_unchanged > 0 && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">
                        {s.rows_unchanged} 未變
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 右：變更明細 */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedId ? (
            <LogTable sessionId={selectedId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <span className="text-4xl">📋</span>
              <p className="text-sm">選擇左側批次查看變更明細</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

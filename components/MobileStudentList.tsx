'use client'

import { useState } from 'react'
import type { Student } from '@/lib/supabase/types'

interface MobileStudentListProps {
  students: Student[]
  isLoading: boolean
}

/**
 * 通用手機版學生列表組件
 * 用於 /students, /counselors, /maintenance 頁面
 */
export default function MobileStudentList({ students, isLoading }: MobileStudentListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const toggleExpand = (id: number) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-200 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <span className="text-4xl mb-3">🔍</span>
        <p className="text-sm font-medium text-slate-500">找不到符合條件的學員</p>
        <p className="text-xs mt-1">試著清除篩選條件</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-200">
      {students.map((student) => {
        const isExpanded = expandedIds.has(student.id)
        return (
          <div key={student.id} className="border-b border-slate-100">
            {/* 簡化摘要行 */}
            <button
              onClick={() => toggleExpand(student.id)}
              className="w-full flex items-center justify-between px-3 py-3 hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-mono text-xs text-gray-500 flex-shrink-0">{student.id}</span>
                <span className="font-medium text-sm text-gray-900 truncate">{student.name}</span>
              </div>
              <span className="text-slate-400 flex-shrink-0 ml-2">
                {isExpanded ? '▼' : '▶'}
              </span>
            </button>

            {/* 展開詳情 */}
            {isExpanded && (
              <div className="bg-slate-50 px-3 py-3 space-y-2 text-xs">
                <Field label="性別" value={student.gender} />
                <Field label="生日" value={student.birthday} />
                <Field label="電話" value={student.phone} />
                <Field label="Line ID" value={student.line_id} />
                <Field label="身份" value={student.role} />
                <Field label="地區" value={student.region} />
                <Field label="會籍到期" value={student.membership_expiry} />
                <Field label="介紹人" value={student.introducer} />
                <Field label="輔導員" value={student.counselor} />
                <Field label="小天使" value={student.little_angel} />
                <Field label="圓夢解盤員" value={student.dream_interpreter} />
                <Field label="輔導長" value={student.senior_counselor} />
                <Field label="分組" value={student.group_leader} />
                <Field label="一階" value={student.course_1} />
                <Field label="二階" value={student.course_2} />
                <Field label="三階" value={student.course_3} />
                <Field label="四階" value={student.course_4} />
                <Field label="五階" value={student.course_5} />
                <Field label="五運" value={student.course_wuyun} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-600 font-medium flex-shrink-0">{label}:</span>
      <span className="text-gray-900 text-right flex-1 break-words">{value}</span>
    </div>
  )
}

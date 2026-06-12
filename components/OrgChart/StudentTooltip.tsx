'use client'

import { memo } from 'react'
import type { OrgStudent } from '@/lib/utils/buildTree'
import { calculateAge } from '@/lib/utils/dateUtils'
import { COURSE_LABELS } from '@/lib/constants'
import type { TooltipPos } from './roleColor'

interface StudentTooltipProps {
  student: OrgStudent
  pos: TooltipPos
}

function StudentTooltipBase({ student, pos }: StudentTooltipProps) {
  const courses = COURSE_LABELS.filter(({ key }) => !!student[key])

  const age = calculateAge(student.birthday)

  const personalInfo = [
    { label: '生理性別', value: student.gender },
    { label: '年齡', value: age !== null ? age : null },
    { label: '介紹人', value: student.introducer },
    { label: '與介紹人關係', value: student.relation },
    { label: '聯誼會籍', value: student.membership_expiry },
    { label: '關懷員', value: student.counselor },
    { label: '傳愛體系', value: student.business_chain },
    { label: '關懷長', value: student.senior_counselor },
    { label: '關懷體系', value: student.guidance_chain },
  ].filter(item => item.value)

  if (courses.length === 0 && personalInfo.length === 0) return null

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: pos.x + 12, top: pos.y - 8 }}
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-4 py-3 min-w-[180px] max-w-[280px]">

        {personalInfo.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1 h-3 rounded bg-blue-400 block" /> 個人資料
            </p>
            <div className="flex flex-col gap-1">
              {personalInfo.map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">{label}</span>
                  <span className="text-[10px] font-medium text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {courses.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span className="w-1 h-3 rounded bg-emerald-400 block" /> 課程紀錄
            </p>
            <div className="flex flex-col gap-1">
              {courses.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">{label}</span>
                  <span className="text-[10px] font-medium text-slate-800 whitespace-nowrap text-right">{String(student[key])}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const StudentTooltip = memo(StudentTooltipBase)

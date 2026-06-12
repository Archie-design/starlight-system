'use client'

import { useState } from 'react'
import type { OrgStudent } from '@/lib/utils/buildTree'
import { StudentTooltip } from './StudentTooltip'
import type { TooltipPos } from './roleColor'

interface StudentNameProps {
  student: OrgStudent
  onClick: () => void
  className?: string
}

export function StudentName({ student, onClick, className }: StudentNameProps) {
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)

  return (
    <span className="relative">
      <button
        onClick={onClick}
        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltipPos(null)}
        className={className}
      >
        <span className="text-slate-400 font-normal">{student.id}_</span>{student.name}
      </button>
      {tooltipPos && <StudentTooltip student={student} pos={tooltipPos} />}
    </span>
  )
}

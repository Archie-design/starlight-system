'use client'

import { useState } from 'react'
import { countDescendants, type TreeNode } from '@/lib/utils/buildTree'
import { StudentName } from './StudentName'
import { getRoleColor } from './roleColor'

interface NodeProps {
  node: TreeNode
  defaultExpanded: boolean
  isLast: boolean
  prefix: string
  onFocus: (node: TreeNode) => void
}

export function OrgChartNode({ node, defaultExpanded, isLast, prefix, onFocus }: NodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { student, children } = node
  const descendantCount = countDescendants(node)
  const hasChildren = children.length > 0

  return (
    <div>
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="whitespace-pre font-mono text-slate-300 text-xs select-none leading-none">
          {prefix}{isLast ? '└─' : '├─'}
        </span>

        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
            title={expanded ? '收合' : '展開'}
          >
            <span className="text-[10px] leading-none">{expanded ? '▾' : '▸'}</span>
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <StudentName
          student={student}
          onClick={() => onFocus(node)}
          className="text-xs text-slate-800 font-medium whitespace-nowrap hover:text-blue-600 hover:underline transition-colors"
        />

        {student.role && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${getRoleColor(student.role)}`}>
            {student.role}
          </span>
        )}

        {hasChildren && (
          <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
            ({descendantCount} 人)
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {children.map((child, i) => (
            <OrgChartNode
              key={child.student.id}
              node={child}
              defaultExpanded={node.depth < 1}
              isLast={i === children.length - 1}
              prefix={prefix + (isLast ? '  ' : '│ ')}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </div>
  )
}

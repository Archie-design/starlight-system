'use client'

import { useOrgData } from '@/hooks/useOrgData'
import { useOrgChartInteraction } from '@/lib/hooks/useOrgChartInteraction'
import { countDescendants } from '@/lib/utils/buildTree'
import type { OrgStudent } from '@/lib/utils/buildTree'
import { OrgChartNode } from './OrgChartNode'
import { FocusedView } from './FocusedView'
import { SearchBox } from './SearchBox'

export default function OrgChart() {
  const { roots, students, totalCount, isLoading } = useOrgData()
  const { focusStack, focusNode, focusStudent, goToBreadcrumb } = useOrgChartInteraction(roots)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
        <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        載入組織圖…
      </div>
    )
  }

  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <span className="text-4xl">🌳</span>
        <p className="text-sm">此體系無學員資料</p>
      </div>
    )
  }

  const focusedNode = focusStack.length > 0 ? focusStack[focusStack.length - 1] : null
  const focusedCount = focusedNode ? countDescendants(focusedNode) : 0

  return (
    <div className="flex flex-col h-full">
      {/* 搜尋 + 麵包屑列 */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-xs flex items-center gap-3 flex-wrap">
        <SearchBox students={students} onSelect={(s: OrgStudent) => focusStudent(s.id)} />

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => goToBreadcrumb(-1)}
            className={`font-medium transition-colors ${
              focusStack.length === 0
                ? 'text-slate-700 cursor-default'
                : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            全體系 ({totalCount.toLocaleString()} 人)
          </button>
          {focusStack.map((node, i) => (
            <span key={node.student.id} className="flex items-center gap-1.5">
              <span className="text-slate-300">›</span>
              <button
                onClick={() => goToBreadcrumb(i)}
                className={`font-medium transition-colors ${
                  i === focusStack.length - 1
                    ? 'text-slate-700 cursor-default'
                    : 'text-blue-600 hover:text-blue-800'
                }`}
              >
                <span className="text-slate-400 font-normal">{node.student.id}_</span>{node.student.name}
              </button>
            </span>
          ))}
          {focusedNode && focusedCount > 0 && (
            <span className="ml-1 text-slate-400">
              共 <span className="font-semibold text-slate-600">{focusedCount}</span> 位下線
            </span>
          )}
        </div>
      </div>

      {/* 樹狀圖 */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {focusStack.length > 0 ? (
          <FocusedView
            path={focusStack}
            onBreadcrumb={goToBreadcrumb}
            onFocus={focusNode}
          />
        ) : (
          roots.map((root, i) => (
            <OrgChartNode
              key={root.student.id}
              node={root}
              defaultExpanded={true}
              isLast={i === roots.length - 1}
              prefix=""
              onFocus={focusNode}
            />
          ))
        )}
      </div>
    </div>
  )
}

'use client'

import { type TreeNode } from '@/lib/utils/buildTree'
import { StudentName } from './StudentName'
import { OrgChartNode } from './OrgChartNode'
import { getRoleColor } from './roleColor'

interface FocusedViewProps {
  path: TreeNode[]          // focusStack，從根到聚焦者
  onBreadcrumb: (i: number) => void
  onFocus: (node: TreeNode) => void
}

export function FocusedView({ path, onBreadcrumb, onFocus }: FocusedViewProps) {
  const focused = path[path.length - 1]

  return (
    <div className="font-mono">
      {/* 上線路徑（祖先鏈） */}
      {path.map((node, i) => {
        const isFocused = i === path.length - 1
        const indent = '  '.repeat(i)
        const connector = i === 0 ? '' : (indent.slice(2) + '└─ ')

        return (
          <div key={node.student.id}>
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="whitespace-pre font-mono text-slate-300 text-xs select-none leading-none">
                {connector}
              </span>

              {/* 展開符號位置 */}
              <span className="w-4 flex-shrink-0" />

              {isFocused ? (
                // 聚焦節點：顯示高亮（也帶 tooltip）
                <StudentName
                  student={node.student}
                  onClick={() => {}}
                  className="text-xs font-bold text-blue-700 whitespace-nowrap bg-blue-50 px-1.5 py-0.5 rounded cursor-default"
                />
              ) : (
                // 祖先節點：可點擊跳回
                <StudentName
                  student={node.student}
                  onClick={() => onBreadcrumb(i)}
                  className="text-xs text-slate-500 font-medium whitespace-nowrap hover:text-blue-600 hover:underline transition-colors"
                />
              )}

              {node.student.role && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${getRoleColor(node.student.role)}`}>
                  {node.student.role}
                </span>
              )}

              {!isFocused && (
                <span className="text-[10px] text-slate-300 whitespace-nowrap">（上線）</span>
              )}
            </div>

            {/* 聚焦節點後渲染其下線 */}
            {isFocused && focused.children.length > 0 && (
              <div>
                {focused.children.map((child, ci) => (
                  <OrgChartNode
                    key={child.student.id}
                    node={child}
                    defaultExpanded={true}
                    isLast={ci === focused.children.length - 1}
                    prefix={'  '.repeat(i + 1)}
                    onFocus={onFocus}
                  />
                ))}
              </div>
            )}

            {isFocused && focused.children.length === 0 && (
              <div className="flex items-center gap-1.5 py-0.5">
                <span className="whitespace-pre font-mono text-slate-200 text-xs select-none">
                  {'  '.repeat(i + 1)}└─{' '}
                </span>
                <span className="text-xs text-slate-300">（無下線）</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { useOrgData } from '@/hooks/useOrgData'
import { countDescendants, findPath, type TreeNode } from '@/lib/utils/buildTree'
import type { OrgStudent } from '@/lib/utils/buildTree'

const ROLE_COLORS: Record<string, string> = {
  '體系長': 'bg-purple-100 text-purple-700',
  '體系長共同經營': 'bg-purple-100 text-purple-700',
  '輔導長': 'bg-blue-100 text-blue-700',
  '輔導長共同經營': 'bg-blue-100 text-blue-700',
  '傳愛領袖': 'bg-cyan-100 text-cyan-700',
  '傳愛領袖共同經營': 'bg-cyan-100 text-cyan-700',
  '輔導員': 'bg-emerald-100 text-emerald-700',
  '輔導員共同經營': 'bg-emerald-100 text-emerald-700',
  '小天使': 'bg-yellow-100 text-yellow-700',
  '會員': 'bg-slate-100 text-slate-500',
}

function getRoleColor(role: string | null): string {
  return role ? (ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-500') : 'bg-slate-100 text-slate-400'
}

// ── 課程浮動提示 ─────────────────────────────────────
const COURSE_LABELS: { key: keyof OrgStudent; label: string }[] = [
  { key: 'course_1', label: '一階' },
  { key: 'course_2', label: '二階' },
  { key: 'course_3', label: '三階' },
  { key: 'course_4', label: '四階' },
  { key: 'course_5', label: '五階' },
  { key: 'course_wuyun', label: '五運' },
  { key: 'life_numbers', label: '生命數字' },
  { key: 'life_numbers_advanced', label: '生命數字實戰' },
  { key: 'life_transform', label: '生命蛻變' },
  { key: 'debt_release', label: '告別負債' },
]

interface TooltipPos { x: number; y: number }

interface CourseTooltipProps {
  student: OrgStudent
  pos: TooltipPos
}

function CourseTooltip({ student, pos }: CourseTooltipProps) {
  const courses = COURSE_LABELS.filter(({ key }) => !!student[key])
  if (courses.length === 0) return null

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: pos.x + 12, top: pos.y - 8 }}
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2 min-w-[140px] max-w-[220px]">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">課程紀錄</p>
        <div className="flex flex-col gap-1">
          {courses.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">{label}</span>
              <span className="text-[10px] font-medium text-slate-700 whitespace-nowrap">{String(student[key])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 學員名稱按鈕（含 Hover Tooltip 控制）────────────────
interface StudentNameProps {
  student: OrgStudent
  onClick: () => void
  className?: string
}

function StudentName({ student, onClick, className }: StudentNameProps) {
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)

  return (
    <span className="relative">
      <button
        onClick={onClick}
        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltipPos(null)}
        className={className}
      >
        {student.name}
      </button>
      {tooltipPos && <CourseTooltip student={student} pos={tooltipPos} />}
    </span>
  )
}

// ── 一般樹狀節點（展開/收合用） ─────────────────────────
interface NodeProps {
  node: TreeNode
  defaultExpanded: boolean
  isLast: boolean
  prefix: string
  onFocus: (node: TreeNode) => void
}

function OrgNode({ node, defaultExpanded, isLast, prefix, onFocus }: NodeProps) {
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
            <OrgNode
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

// ── 聚焦視圖：顯示上線路徑 + 聚焦節點的下線 ────────────
interface FocusedViewProps {
  path: TreeNode[]          // focusStack，從根到聚焦者
  onBreadcrumb: (i: number) => void
  onFocus: (node: TreeNode) => void
}

function FocusedView({ path, onBreadcrumb, onFocus }: FocusedViewProps) {
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
                  <OrgNode
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

// ── 搜尋框 ──────────────────────────────────────────────
interface SearchBoxProps {
  students: OrgStudent[]
  onSelect: (student: OrgStudent) => void
}

function SearchBox({ students, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const results = query.trim().length >= 1
    ? students.filter(s => s.name.includes(query.trim())).slice(0, 20)
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
        <input
          type="text"
          placeholder="搜尋學員姓名…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="border border-slate-300 rounded pl-6 pr-2 py-1 text-xs w-44 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-xs"
          >✕</button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-slate-200 rounded shadow-lg w-56 max-h-60 overflow-auto">
          {results.map(s => (
            <button
              key={s.id}
              onClick={() => { onSelect(s); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors text-left"
            >
              <span className="font-medium text-slate-800 flex-1">{s.name}</span>
              {s.role && (
                <span className={`text-[10px] px-1 py-0.5 rounded-full ${getRoleColor(s.role)}`}>{s.role}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 1 && results.length === 0 && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-slate-200 rounded shadow-lg w-56 px-3 py-2 text-xs text-slate-400">
          找不到符合的學員
        </div>
      )}
    </div>
  )
}

// ── 主元件 ──────────────────────────────────────────────
export default function OrgChart() {
  const { roots, students, totalCount, isLoading } = useOrgData()
  const [focusStack, setFocusStack] = useState<TreeNode[]>([])

  const handleFocus = (node: TreeNode) => {
    // 點擊節點時，找出完整路徑並設定 focusStack
    const path = findPath(roots, node.student.id)
    if (path.length > 0) setFocusStack(path)
  }

  const handleBreadcrumb = (index: number) => {
    setFocusStack(prev => index === -1 ? [] : prev.slice(0, index + 1))
  }

  const handleSearch = (student: OrgStudent) => {
    const path = findPath(roots, student.id)
    if (path.length > 0) setFocusStack(path)
  }

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
        <SearchBox students={students} onSelect={handleSearch} />

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => handleBreadcrumb(-1)}
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
                onClick={() => handleBreadcrumb(i)}
                className={`font-medium transition-colors ${
                  i === focusStack.length - 1
                    ? 'text-slate-700 cursor-default'
                    : 'text-blue-600 hover:text-blue-800'
                }`}
              >
                {node.student.name}
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
            onBreadcrumb={handleBreadcrumb}
            onFocus={handleFocus}
          />
        ) : (
          roots.map((root, i) => (
            <OrgNode
              key={root.student.id}
              node={root}
              defaultExpanded={true}
              isLast={i === roots.length - 1}
              prefix=""
              onFocus={handleFocus}
            />
          ))
        )}
      </div>
    </div>
  )
}

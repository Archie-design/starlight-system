'use client'

import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useOrgData } from '@/hooks/useOrgData'
import { buildRelations, type RelatedStudent } from '@/lib/utils/relations'
import type { OrgStudent } from '@/lib/utils/buildTree'
import { SearchBox } from '@/components/OrgChart/SearchBox'

const COHORT_COLOR = '#3b82f6' // 藍：同期同學
const SPIRIT_COLOR = '#f59e0b' // 琥珀：同組組員
const MAX_PER_GROUP = 40        // 每群節點上限，避免過載

/** 把關聯結果依「群組（同期梯次 / 心之使者組）」分桶 */
interface Group {
  key: string
  label: string
  type: 'cohort' | 'spirit'
  members: RelatedStudent[]
}

function groupRelations(related: RelatedStudent[]): Group[] {
  const groups = new Map<string, Group>()
  for (const r of related) {
    for (const cl of r.cohortLabels) {
      const k = `cohort:${cl}`
      if (!groups.has(k)) groups.set(k, { key: k, label: cl, type: 'cohort', members: [] })
      groups.get(k)!.members.push(r)
    }
    if (r.spiritLabel) {
      const k = `spirit:${r.spiritLabel}`
      if (!groups.has(k)) groups.set(k, { key: k, label: r.spiritLabel, type: 'spirit', members: [] })
      groups.get(k)!.members.push(r)
    }
  }
  // 同期群在前、同組群在後；各依人數多到少
  return Array.from(groups.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'cohort' ? -1 : 1
    return b.members.length - a.members.length
  })
}

export default function RelationshipNetwork() {
  const { students, isLoading } = useOrgData()
  const [centerId, setCenterId] = useState<number | null>(null)

  const result = useMemo(
    () => (centerId == null ? null : buildRelations(students, centerId)),
    [students, centerId]
  )
  const groups = useMemo(() => (result ? groupRelations(result.related) : []), [result])

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!result) return { nodes: [], edges: [] }
    const nodes: Node[] = []
    const edges: Edge[] = []

    // 中心節點
    nodes.push({
      id: `c-${result.center.id}`,
      position: { x: 0, y: 0 },
      data: { label: `${result.center.name}` },
      style: CENTER_STYLE,
      draggable: false,
    })

    // 每個群組一條放射軸；群內成員沿該軸排開
    const groupCount = groups.length || 1
    groups.forEach((g, gi) => {
      const angle = (2 * Math.PI * gi) / groupCount - Math.PI / 2
      const color = g.type === 'cohort' ? COHORT_COLOR : SPIRIT_COLOR
      const shown = g.members.slice(0, MAX_PER_GROUP)
      shown.forEach((m, mi) => {
        // 沿群軸方向、依序往外排（半徑遞增），並左右微張角分散
        const ring = 1 + mi
        const spread = (mi % 5 - 2) * 0.12
        const a = angle + spread
        const radius = 180 + ring * 14
        const id = `s-${m.student.id}`
        if (!nodes.find((n) => n.id === id)) {
          nodes.push({
            id,
            position: { x: Math.cos(a) * radius, y: Math.sin(a) * radius },
            data: { label: m.student.name },
            style: MEMBER_STYLE,
            draggable: true,
          })
        }
        edges.push({
          id: `e-${g.key}-${m.student.id}`,
          source: `c-${result.center.id}`,
          target: id,
          label: mi === 0 ? `${g.label}${g.members.length > MAX_PER_GROUP ? `（${g.members.length}人，顯示前${MAX_PER_GROUP}）` : `（${g.members.length}）`}` : undefined,
          style: { stroke: color, strokeWidth: 1.5 },
          labelStyle: { fill: color, fontSize: 11, fontWeight: 600 },
          labelBgStyle: { fill: '#fff' },
        })
      })
    })
    return { nodes, edges }
  }, [result, groups])

  const handlePick = (s: OrgStudent) => setCenterId(s.id)

  return (
    <div className="flex flex-col h-full">
      {/* 搜尋 + 圖例 */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-4 flex-wrap">
        <SearchBox students={students} onSelect={handlePick} />
        {result && (
          <span className="text-xs text-slate-600">
            中心：<span className="font-semibold">{result.center.name}</span>
          </span>
        )}
        <div className="flex items-center gap-3 text-xs ml-auto">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: COHORT_COLOR }} /> 同期同學</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: SPIRIT_COLOR }} /> 同組組員</span>
        </div>
      </div>

      {/* 圖區 */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
            <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            載入資料…
          </div>
        ) : !result ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <span className="text-4xl">🔗</span>
            <p className="text-sm">請搜尋一位學員，檢視其同期同學與同組組員關聯</p>
          </div>
        ) : result.related.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <span className="text-4xl">🔗</span>
            <p className="text-sm font-medium text-slate-500">{result.center.name} 目前無同期同學或同組組員</p>
            <p className="text-xs">
              {!result.centerHasCohort && '（無有效梯次資料）'}
              {!result.centerHasSpirit && ' （無心之使者組別）'}
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            minZoom={0.2}
            maxZoom={1.5}
            onNodeClick={(_, node) => {
              const id = Number(String(node.id).replace(/^[cs]-/, ''))
              if (!Number.isNaN(id) && id !== centerId) setCenterId(id)
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

const CENTER_STYLE: React.CSSProperties = {
  background: '#1d4ed8',
  color: '#fff',
  border: '2px solid #1e40af',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  width: 'auto',
}

const MEMBER_STYLE: React.CSSProperties = {
  background: '#fff',
  color: '#1e293b',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '5px 9px',
  fontSize: 12,
  width: 'auto',
  cursor: 'pointer',
}

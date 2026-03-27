'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts'
import Link from 'next/link'

// UI Components
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// -------------------------------------------------------------------------------- //

type DashboardProps = {
  totalStudents: number
  courseFunnel: { stage: string; count: number }[]
  groupStudents: { group_leader: string }[]
  membershipData: { id: string; name: string; membership_expiry: string }[]
  spiritData: any[]
  importHistory: any[]
  regionData: any[]
  wuyunData: any[]
  newStudentsData: any[]
  paymentDistribution: any[]
  unpaidAlerts: { id: number; name: string; unpaid: { label: string; status: string }[] }[]
}

export default function DashboardClient({
  totalStudents,
  courseFunnel,
  groupStudents,
  membershipData,
  paymentDistribution,
  unpaidAlerts,
}: DashboardProps) {
  // 1. 各組人數計算
  const groupStats = useMemo(() => {
    const counts: Record<string, number> = {}
    groupStudents.forEach((s) => {
      const name = s.group_leader.trim() || '未分組'
      counts[name] = (counts[name] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count) // 由大到小排序
  }, [groupStudents])

  // 2. 付款狀態分類（找出所有可能的狀態以建立 Bar）
  const paymentStatuses = useMemo(() => {
    const statuses = new Set<string>()
    paymentDistribution.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'name') statuses.add(k)
      })
    })
    return Array.from(statuses)
  }, [paymentDistribution])

  const getStatusColor = (status: string) => {
    switch (status) {
      case '已完款': return '#10b981' // emerald-500
      case '部分付款/金額': return '#f59e0b' // amber-500
      case '未完款': return '#ef4444' // red-500
      default: return '#cbd5e1' // slate-300
    }
  }

  // 排序狀態，讓「已完款」固定在最下面
  const sortedStatuses = useMemo(() => {
    const order = ['已完款', '部分付款/金額', '未完款', '其他']
    return paymentStatuses.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }, [paymentStatuses])
  const membershipAlerts = useMemo(() => {
    const now = new Date().getTime()
    const msPerDay = 1000 * 60 * 60 * 24

    const expired: typeof membershipData = []
    const within30: typeof membershipData = []
    const within90: typeof membershipData = []

    membershipData.forEach((s) => {
      if (!s.membership_expiry) return
      const expiry = new Date(s.membership_expiry).getTime()
      const diffDays = Math.ceil((expiry - now) / msPerDay)

      if (diffDays < 0) {
        expired.push(s)
      } else if (diffDays <= 30) {
        within30.push(s)
      } else if (diffDays <= 90) {
        within90.push(s)
      }
    })

    return { expired, within30, within90 }
  }, [membershipData])

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg">📊</span>
          <h1 className="text-lg font-bold text-slate-800 tracking-wide">系統儀表板</h1>
        </div>
        <div className="flex gap-4">
          <Link href="/students" className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium">
            回學員列表 →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* KPI 總覽 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="p-6">
                <div className="text-slate-500 text-sm font-medium">系統總學員數</div>
                <div className="text-4xl font-bold text-blue-600 mt-2">{totalStudents}</div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="text-slate-500 text-sm font-medium">已過期會籍</div>
                <div className="text-3xl font-bold text-red-600 mt-2">{membershipAlerts.expired.length}</div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="text-slate-500 text-sm font-medium">30天內到期會籍</div>
                <div className="text-3xl font-bold text-orange-500 mt-2">{membershipAlerts.within30.length}</div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="text-slate-500 text-sm font-medium">有組別學員數</div>
                <div className="text-3xl font-bold text-slate-800 mt-2">{groupStudents.length}</div>
              </div>
            </Card>
          </div>

          {/* 課程漏斗與各組人數 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="課程進度漏斗" subtitle="各階學員的留存與轉換狀況" />
              <div className="h-[350px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Funnel
                      dataKey="count"
                      data={courseFunnel}
                      isAnimationActive
                    >
                      <LabelList position="right" fill="#334155" stroke="none" dataKey="stage" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="各組人數統計" subtitle="各輔導長組別之目前學員數" />
              <div className="h-[350px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupStats} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="count" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* 付款狀態分布 */}
          <Card>
            <CardHeader title="課程付款狀態分布" subtitle="僅統計已報名/已出席該階課程之學員付款狀況" />
            <div className="h-[350px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  {sortedStatuses.map(status => (
                    <Bar 
                      key={status} 
                      dataKey={status} 
                      stackId="a" 
                      fill={getStatusColor(status)} 
                      radius={[2, 2, 2, 2]} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 會籍到期預警 */}
            <Card>
              <CardHeader title="會籍到期預警清單" subtitle="顯示已過期與 30 天內即將到期的會籍" />
              <div className="p-0 max-h-[500px] overflow-auto">
                {membershipAlerts.within30.length === 0 && membershipAlerts.expired.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">近期無即將到期會籍 🎉</div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-6 font-medium text-slate-600">學員名稱</th>
                        <th className="py-3 px-6 font-medium text-slate-600">狀態 / 到期日</th>
                        <th className="py-3 px-6 font-medium text-slate-600 text-right">剩餘天數</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...membershipAlerts.expired, ...membershipAlerts.within30].map((s) => {
                         const expiry = new Date(s.membership_expiry).getTime()
                         const diffDays = Math.ceil((expiry - new Date().getTime()) / 86400000)
                         const isExpired = diffDays < 0
                         return (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-6 font-medium text-slate-800">{s.name}</td>
                            <td className="py-3 px-6 text-slate-600 text-[13px]">
                              {isExpired ? <span className="text-red-600 font-medium">已過期</span> : s.membership_expiry.split('T')[0]}
                            </td>
                            <td className="py-3 px-6 font-mono text-right font-medium text-orange-600 text-[13px]">
                              {isExpired ? '-' : `${diffDays} 天`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            {/* 未完款學員預警 */}
            <Card>
              <CardHeader title="未完款學員預警 (有紀錄但未完款)" subtitle="列出已參加課程但付款狀態欄位非『完款』的學員" />
              <div className="p-0 max-h-[500px] overflow-auto">
                {unpaidAlerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">目前無異常未完款紀錄 🎉</div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-6 font-medium text-slate-600">學員名稱</th>
                        <th className="py-3 px-6 font-medium text-slate-600">欠款項目與備註</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unpaidAlerts.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-6 font-medium text-slate-800 whitespace-nowrap align-top">{s.name}</td>
                          <td className="py-3 px-6 space-y-1.5">
                            {s.unpaid.map((u, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold border border-slate-200">
                                  {u.label}
                                </span>
                                <span className="text-orange-600 text-[12px] font-medium italic">
                                  {u.status}
                                </span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import ExcelJS from 'exceljs'
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

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
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
  distributionDetail: any[]
  unpaidAlerts: { id: number; name: string; unpaid: { label: string; status: string }[] }[]
}

export default function DashboardClient({
  totalStudents,
  courseFunnel,
  groupStudents,
  membershipData,
  paymentDistribution,
  distributionDetail,
  unpaidAlerts,
}: DashboardProps) {
  const [selectedSegment, setSelectedSegment] = useState<{ stage: string; status: string } | null>(null)
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
      case '部分付款': return '#f59e0b' // amber-500
      case '未完款': return '#ef4444' // red-500
      default: return '#94a3b8' // slate-400
    }
  }

  // 排序狀態，讓「已完款」固定在最下面
  const sortedStatuses = useMemo(() => {
    const order = ['已完款', '部分付款', '未完款']
    return paymentStatuses
      .filter(s => order.includes(s))
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }, [paymentStatuses])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0)
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
          <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{label} 付款分佈</p>
          <div className="space-y-1.5">
            {payload.slice().reverse().map((entry: any, index: number) => {
              const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0
              return (
                <div key={index} className="flex items-center justify-between gap-8 text-[13px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-slate-600 font-medium">{entry.name}:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 font-bold">{entry.value} 人</span>
                    <span className="text-slate-400 text-xs">({percentage}%)</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[13px] font-bold text-slate-700">
            <span>該階總計:</span>
            <span>{total} 人</span>
          </div>
        </div>
      )
    }
    return null
  }

  // 3. 過濾選中區塊的名單
  const selectedStudents = useMemo(() => {
    if (!selectedSegment) return []
    const { stage, status } = selectedSegment

    // 階段對應欄位
    const stageMap: Record<string, { course: string; payment: string }> = {
      '一階': { course: 'course_1', payment: 'payment_1' },
      '二階': { course: 'course_2', payment: 'payment_2' },
      '三階': { course: 'course_3', payment: 'payment_3' },
      '四階': { course: 'course_4', payment: 'payment_4' },
      '五階': { course: 'course_5', payment: 'payment_5' },
      '五運': { course: 'course_wuyun', payment: 'payment_wuyun' },
    }

    const keys = stageMap[stage]
    if (!keys) return []

    // 內部定義歸類邏輯 (與 Server 同步)
    const normalize = (val: string | null) => {
      if (!val) return '未完款'
      const v = val.trim()
      if (v === '已完款' || v === '完款' || v === '1' || v === 'true' || v.includes('完款') || v === '已付' || v === '繳清') return '已完款'
      if (/^\d+(\.\d+)?$/.test(v) || v.includes('訂金') || v === '有的') return '部分付款'
      return '未完款'
    }

    return distributionDetail.filter(s => {
      const isEnrolled = !!s[keys.course]
      const currentStatus = normalize(s[keys.payment])
      return isEnrolled && currentStatus === status
    }).map(s => ({
      ...s,
      actualPayment: s[keys.payment] || '（空白）'
    }))
  }, [selectedSegment, distributionDetail])

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

  const exportMembershipToExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('會籍到期預警')

    // 設定標題
    worksheet.columns = [
      { header: '學員姓名', key: 'name', width: 20 },
      { header: '狀態', key: 'status', width: 15 },
      { header: '到期日期', key: 'expiry', width: 20 },
      { header: '剩餘天數', key: 'days', width: 15 },
    ]

    // 準備數據
    const rows = [...membershipAlerts.expired, ...membershipAlerts.within30].map(s => {
      const expiryDate = new Date(s.membership_expiry)
      const diffDays = Math.ceil((expiryDate.getTime() - new Date().getTime()) / 86400000)
      const isExpired = diffDays < 0

      return {
        name: s.name,
        status: isExpired ? '已過期' : '即將到期',
        expiry: s.membership_expiry.split('T')[0],
        days: isExpired ? '-' : `${diffDays} 天`
      }
    })

    worksheet.addRows(rows)

    // 美化表格
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F1F5F9' }
    }

    // 匯出檔案
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `會籍到期預警清單_${new Date().toISOString().split('T')[0]}.xlsx`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

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
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.4 }} />
                  {sortedStatuses.map((status, index) => (
                    <Bar 
                      key={status} 
                      dataKey={status} 
                      name={status}
                      stackId="a" 
                      fill={getStatusColor(status)} 
                      radius={index === sortedStatuses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                      barSize={45}
                      className="cursor-pointer"
                      onClick={(data) => {
                        if (data && data.name) {
                          setSelectedSegment({ stage: data.name, status })
                        }
                      }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 會籍到期預警 */}
            <Card>
              <CardHeader 
                title="會籍到期預警清單" 
                subtitle="顯示已過期與 30 天內即將到期的會籍" 
                action={
                  <button
                    onClick={exportMembershipToExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-all shadow-sm active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    匯出 Excel
                  </button>
                }
              />
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
                            <td className="py-3 px-6 font-medium text-slate-800">
                              <Link 
                                href={`/students?search=${encodeURIComponent(s.name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {s.name}
                              </Link>
                            </td>
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
                          <td className="py-3 px-6 font-medium text-slate-800 whitespace-nowrap align-top">
                            <Link 
                              href={`/students?search=${encodeURIComponent(s.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {s.name}
                            </Link>
                          </td>
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

      {/* 詳情彈窗 */}
      {selectedSegment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSegment(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {selectedSegment.stage} — {selectedSegment.status} 名單
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">共有 {selectedStudents.length} 位學員</p>
              </div>
              <button 
                onClick={() => setSelectedSegment(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-3 px-6 font-bold text-slate-600">姓名</th>
                    <th className="py-3 px-6 font-bold text-slate-600">輔導長</th>
                    <th className="py-3 px-6 font-bold text-slate-600">原始付款紀錄</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedStudents.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-6">
                        <Link 
                          href={`/students?search=${encodeURIComponent(s.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="py-3 px-6 text-slate-600">{s.group_leader || '未分組'}</td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[12px] border border-slate-200">
                          {s.actualPayment}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {selectedStudents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-400 italic">
                        該分類目前無學員
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button 
                onClick={() => setSelectedSegment(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

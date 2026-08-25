import { redirect } from 'next/navigation'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { applySystemFilter } from '@/lib/utils/system'
import { APP_NAME } from '@/lib/config'
import DashboardClient from './DashboardClient'

export const metadata = {
  title: `儀表板 — ${APP_NAME}`,
  description: '學員課程、付款、會籍、組群統計總覽',
}

export default async function DashboardPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.must_change_password) redirect('/account/change-password')

  const system = await getEffectiveSystem(user!)
  const service = createServiceClient()

  // 先獲取本體系總人數以計算分頁
  const totalResult = await applySystemFilter(
    service.from('students').select('id', { count: 'exact', head: true }),
    system,
  )
  const totalStudents = totalResult.count ?? 0

  const pageSize = 1000
  const pages = Math.ceil(totalStudents / pageSize)

  const pagePromises = []
  for (let i = 0; i < pages; i++) {
    pagePromises.push(
      applySystemFilter(
        service
          .from('students')
          .select(`
            id, name, group_leader, membership_expiry,
            spirit_ambassador_join_date, cumulative_seniority,
            region, wuyun_a, wuyun_b, wuyun_c, wuyun_d, wuyun_f,
            created_at, introducer,
            course_1, course_2, course_3, course_4, course_5, course_wuyun,
            payment_1, payment_2, payment_3, payment_4, payment_5, payment_wuyun
          `),
        system,
      ).range(i * pageSize, (i + 1) * pageSize - 1)
    )
  }

  // 平行執行輔助查詢與所有分頁查詢
  const [importResult, ...studentsResults] = await Promise.all([
    service
      .from('import_sessions')
      .select('imported_at, rows_updated, rows_inserted, rows_unchanged')
      .eq('applied', true)
      .order('imported_at', { ascending: true })
      .limit(20),
    ...pagePromises,
  ])

  const allStudents = studentsResults.flatMap(r => r.data || [])

  // 10. 付款狀態分布聚合
  const normalizePayment = (val: string | null) => {
    if (!val) return '退款完成'
    const v = val.trim()
    
    // 完款類
    if (v === '已完款' || v === '完款' || v === '1' || v === 'true' || v.includes('完款') || v === '已付' || v === '繳清') {
      return '已完款'
    }
    
    // 數字或訂金類 (通常代表已付部分款項或記錄金額)
    if (/^\d+(\.\d+)?$/.test(v) || v.includes('訂金') || v === '有的') {
      return '部分付款'
    }

    if (v === '未完款' || v === '退款完成' || v === '0' || v === 'false' || v === '無' || v === 'x') {
      return '退款完成'
    }

    return '退款完成' // 其他一律歸類為退款完成
  }

  const paymentStages = [
    { label: '一階', key: 'payment_1' },
    { label: '二階', key: 'payment_2' },
    { label: '三階', key: 'payment_3' },
    { label: '四階', key: 'payment_4' },
    { label: '五階', key: 'payment_5' },
    { label: '五運', key: 'payment_wuyun' },
  ]

  // 各階上課人數（courseFunnel）、付款狀態分布（paymentDistribution）、
  // 退款完成清單（unpaidAlerts）原本各自對 allStudents 獨立跑一輪
  // .filter()/.map()（約 15 次遍歷），改為單一 reduce 合併成一次遍歷。
  // 註：三/四/五階不拘順序，courseFunnel 以「各階人數長條」呈現，而非暗示流失的漏斗。
  const courseFunnelCounts = [0, 0, 0, 0, 0, 0]
  const paymentCounts = paymentStages.map(() => ({ 已完款: 0, 部分付款: 0, 退款完成: 0 }))
  const groupStudents: { group_leader: string }[] = []
  const membershipData: { id: string; name: string; membership_expiry: string }[] = []
  const unpaidAlerts: { id: number; name: string; unpaid: { label: string; status: string }[] }[] = []
  const distributionDetail: Array<Record<string, unknown>> = []

  const courseKeys = ['course_1', 'course_2', 'course_3', 'course_4', 'course_5', 'course_wuyun'] as const

  for (const s of allStudents) {
    // courseFunnel + paymentDistribution：同一輪跑完 6 個階別
    const unpaid: { label: string; status: string }[] = []
    for (let i = 0; i < paymentStages.length; i++) {
      const courseKey = courseKeys[i]
      const enrolled = !!s[courseKey as keyof typeof s]
      if (enrolled) courseFunnelCounts[i]++

      const stage = paymentStages[i]
      const rawStatus = s[stage.key as keyof typeof s] as string | null
      if (enrolled) {
        const status = normalizePayment(rawStatus)
        paymentCounts[i][status as '已完款' | '部分付款' | '退款完成']++
        if (status !== '已完款') {
          unpaid.push({ label: stage.label, status: rawStatus || '（空白）' })
        }
      }
    }
    if (unpaid.length > 0 && unpaidAlerts.length < 100) {
      // 限制筆數，避免 Client 負載過重（維持原本 slice(0, 100) 的行為）
      unpaidAlerts.push({ id: s.id, name: s.name, unpaid })
    }

    if (s.group_leader !== null) groupStudents.push({ group_leader: s.group_leader })
    if (s.membership_expiry !== null) {
      membershipData.push({ id: String(s.id), name: s.name, membership_expiry: s.membership_expiry })
    }

    distributionDetail.push({
      id: s.id,
      name: s.name,
      group_leader: s.group_leader,
      course_1: s.course_1,
      course_2: s.course_2,
      course_3: s.course_3,
      course_4: s.course_4,
      course_5: s.course_5,
      course_wuyun: s.course_wuyun,
      payment_1: s.payment_1,
      payment_2: s.payment_2,
      payment_3: s.payment_3,
      payment_4: s.payment_4,
      payment_5: s.payment_5,
      payment_wuyun: s.payment_wuyun,
    })
  }

  const courseFunnel: { stage: string; count: number }[] = paymentStages.map((stage, i) => ({
    stage: stage.label,
    count: courseFunnelCounts[i],
  }))

  const paymentDistribution = paymentStages.map((stage, i) => ({
    name: stage.label,
    ...paymentCounts[i],
  }))

  membershipData.sort((a, b) => new Date(a.membership_expiry).getTime() - new Date(b.membership_expiry).getTime())

  return (
    <DashboardClient
      totalStudents={totalStudents}
      courseFunnel={courseFunnel}
      groupStudents={groupStudents}
      membershipData={membershipData}
      paymentDistribution={paymentDistribution}
      distributionDetail={distributionDetail as any}
      unpaidAlerts={unpaidAlerts as any[]}
    />
  )
}

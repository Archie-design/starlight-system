import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export const metadata = {
  title: '儀表板 — 星光超級表格系統',
  description: '學員課程、付款、會籍、組群統計總覽',
}

export default async function DashboardPage() {
  // Auth guard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  // 先獲取總人數以計算分頁
  const totalResult = await service.from('students').select('id', { count: 'exact', head: true })
  const totalStudents = totalResult.count ?? 0

  const pageSize = 1000
  const pages = Math.ceil(totalStudents / pageSize)
  
  const pagePromises = []
  for (let i = 0; i < pages; i++) {
    pagePromises.push(
      service
        .from('students')
        .select(`
          id, name, group_leader, membership_expiry,
          spirit_ambassador_join_date, cumulative_seniority,
          region, wuyun_a, wuyun_b, wuyun_c, wuyun_d, wuyun_f,
          created_at, introducer,
          course_1, course_2, course_3, course_4, course_5, course_wuyun,
          payment_1, payment_2, payment_3, payment_4, payment_5, payment_wuyun
        `)
        .range(i * pageSize, (i + 1) * pageSize - 1)
    )
  }

  // 平行執行輔助查詢與所有分頁查詢
  const [importResult, courseResult, ...studentsResults] = await Promise.all([
    service
      .from('import_sessions')
      .select('imported_at, rows_updated, rows_inserted, rows_unchanged')
      .eq('applied', true)
      .order('imported_at', { ascending: true })
      .limit(20),
    service.rpc('get_course_funnel'),
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

  const paymentDistribution = paymentStages.map((stage, index) => {
    const courseKey = `course_${index + 1}` as keyof typeof allStudents[0]
    const actualCourseKey = stage.key === 'payment_wuyun' ? 'course_wuyun' : courseKey
    
    const enrolledStudents = allStudents.filter(s => !!s[actualCourseKey as keyof typeof s])
    
    const counts: Record<string, number> = {
      '已完款': 0,
      '部分付款': 0,
      '退款完成': 0
    }
    
    enrolledStudents.forEach(s => {
      const status = normalizePayment(s[stage.key as keyof typeof s] as string | null)
      counts[status] = (counts[status] || 0) + 1
    })
    return { name: stage.label, ...counts }
  })

  // 整理 subsets 傳遞給 Client Component 減少 JSON 大小
  let courseFunnel: { stage: string; count: number }[] = []
  if (courseResult.error) {
    // fallback: 直接拉欄位做 client-side count
    courseFunnel = [
      { stage: '一階', count: allStudents.filter((r) => r.course_1).length },
      { stage: '二階', count: allStudents.filter((r) => r.course_2).length },
      { stage: '三階', count: allStudents.filter((r) => r.course_3).length },
      { stage: '四階', count: allStudents.filter((r) => r.course_4).length },
      { stage: '五階', count: allStudents.filter((r) => r.course_5).length },
    ]
  } else {
    courseFunnel = courseResult.data ?? []
  }

  const groupStudents = allStudents
    .filter((s) => s.group_leader !== null)
    .map((s) => ({ group_leader: s.group_leader }))

  const membershipData = allStudents
    .filter((s) => s.membership_expiry !== null)
    .map((s) => ({ id: s.id, name: s.name, membership_expiry: s.membership_expiry }))
    .sort((a, b) => new Date(a.membership_expiry).getTime() - new Date(b.membership_expiry).getTime())

  const spiritData = allStudents
    .filter((s) => s.spirit_ambassador_join_date !== null)
    .map((s) => ({
      spirit_ambassador_join_date: s.spirit_ambassador_join_date,
      cumulative_seniority: s.cumulative_seniority,
    }))

  const regionData = allStudents
    .filter((s) => s.region !== null)
    .map((s) => ({ region: s.region }))

  const wuyunData = allStudents.map((s) => ({
    wuyun_a: s.wuyun_a,
    wuyun_b: s.wuyun_b,
    wuyun_c: s.wuyun_c,
    wuyun_d: s.wuyun_d,
    wuyun_f: s.wuyun_f,
  }))

  const unpaidStudentsData = allStudents
    .map((s) => ({ created_at: s.created_at, introducer: s.introducer }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // 11. 退款完成學員清單 (有上課但退款完成)
  const unpaidAlerts = allStudents.map(s => {
    const unpaid = paymentStages.filter((stage, index) => {
      const courseKey = stage.key === 'payment_wuyun' ? 'course_wuyun' : `course_${index + 1}`
      const isEnrolled = !!s[courseKey as keyof typeof s]
      const status = normalizePayment(s[stage.key as keyof typeof s] as string | null)
      return isEnrolled && status !== '已完款'
    }).map(stage => ({
      label: stage.label,
      status: (s[stage.key as keyof typeof s] as string | null) || '（空白）'
    }))

    if (unpaid.length > 0) {
      return { id: s.id, name: s.name, unpaid }
    }
    return null
  }).filter(Boolean).slice(0, 100) // 限制筆數，避免 Client 負載過重

  const distributionDetail = allStudents.map(s => ({
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
  }))

  return (
    <DashboardClient
      totalStudents={totalStudents}
      courseFunnel={courseFunnel}
      groupStudents={groupStudents}
      membershipData={membershipData}
      spiritData={spiritData}
      importHistory={importResult.data ?? []}
      regionData={regionData}
      wuyunData={wuyunData}
      newStudentsData={unpaidStudentsData}
      paymentDistribution={paymentDistribution}
      distributionDetail={distributionDetail as any}
      unpaidAlerts={unpaidAlerts as any[]}
    />
  )
}

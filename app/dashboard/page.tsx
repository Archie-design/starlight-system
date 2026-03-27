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
          course_1, course_2, course_3, course_4, course_5
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

  const newStudentsData = allStudents
    .map((s) => ({ created_at: s.created_at, introducer: s.introducer }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

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
      newStudentsData={newStudentsData}
    />
  )
}

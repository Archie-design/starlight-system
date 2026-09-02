import { redirect } from 'next/navigation'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { applySystemFilter } from '@/lib/utils/system'
import { parseNameWithId } from '@/lib/utils/nameUtils'
import { findSelfReferences, findDanglingPointers } from '@/lib/utils/littleAngel'
import { buildTree, type OrgStudent } from '@/lib/utils/buildTree'
import { APP_NAME } from '@/lib/config'
import LittleAngelClient from './LittleAngelClient'

export const metadata = {
  title: `小天使專區 — ${APP_NAME}`,
}

type Row = {
  id: number
  name: string
  little_angel: string | null
  business_chain: string | null
  county: string | null
}

const UNSPECIFIED_COUNTY = '未填寫'

export default async function LittleAngelPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.must_change_password) redirect('/account/change-password')

  const system = await getEffectiveSystem(user!)
  const service = createServiceClient()

  // 分頁撈本體系全量學員（只取小天使相關欄位）。務必分頁——PostgREST
  // 預設單次查詢上限 1000 筆，若不分頁在資料量超過此數時會靜默漏資料
  // （開發過程中曾直接踩到這個坑：第一次驗證資料品質 helper 時沒分頁，
  // 誤判部分循環/懸空案例不存在）。
  const all: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await applySystemFilter(
      service
        .from('students')
        .select('id, name, little_angel, business_chain, county'),
      system,
    ).range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Row[]))
    if (data.length < 1000) break
  }

  // 小天使從屬關係 = little_angel 非空的學員
  const withAngel = all.filter((s) => s.little_angel)

  // KPI：不重複小天使人數、被帶學員總數、平均每位小天使帶人數、無小天使人數
  const angelIds = new Set<number>()
  for (const s of withAngel) {
    const { id } = parseNameWithId(s.little_angel)
    if (id !== null) angelIds.add(id)
  }
  const kpi = {
    angelCount: angelIds.size,
    ledCount: withAngel.length,
    avgLedPerAngel: angelIds.size > 0 ? Math.round((withAngel.length / angelIds.size) * 10) / 10 : 0,
    noAngelCount: all.length - withAngel.length,
  }

  // 排行榜：各小天使（依 id）直接帶的人數，由多到少
  const byId = new Map(all.map((s) => [s.id, s]))
  const ledCountByAngel = new Map<number, number>()
  for (const s of withAngel) {
    const { id } = parseNameWithId(s.little_angel)
    if (id !== null) ledCountByAngel.set(id, (ledCountByAngel.get(id) ?? 0) + 1)
  }
  const ranking = Array.from(ledCountByAngel.entries())
    .map(([id, count]) => ({ id, name: byId.get(id)?.name ?? `(id ${id})`, count }))
    .sort((a, b) => b.count - a.count)

  // 地區（縣市）分布：以「被帶學員」為統計母體，county 為空歸類為「未填寫」
  const countyMap = new Map<string, number>()
  for (const s of withAngel) {
    const county = (s.county ?? '').trim() || UNSPECIFIED_COUNTY
    countyMap.set(county, (countyMap.get(county) ?? 0) + 1)
  }
  const countyDist = Array.from(countyMap.entries())
    .map(([county, count]) => ({ county, count }))
    .sort((a, b) => b.count - a.count)

  // 資料品質：自我指向、懸空指標（各自獨立的檢查，見 lib/utils/littleAngel.ts
  // 的說明——不能只靠 buildTree 的 brokenCycleIds，那個不含自我指向案例）
  const selfReferences = findSelfReferences(all)
  const danglingPointers = findDanglingPointers(all)

  // 雙向互指（及更長的循環）：buildTree 的循環偵測已內建，重用它取得
  // brokenCycleIds，再回頭找出對應的學員資訊供頁面顯示
  const orgStudents: OrgStudent[] = all.map((s) => ({
    id: s.id,
    name: s.name,
    role: null,
    region: null,
    introducer: null,
    course_1: null,
    course_2: null,
    course_3: null,
    course_4: null,
    course_5: null,
    course_wuyun: null,
    life_numbers: null,
    life_numbers_advanced: null,
    life_transform: null,
    debt_release: null,
    little_angel: s.little_angel,
  }))
  const { brokenCycleIds } = buildTree(orgStudents, 'little_angel')
  const mutualCycles = brokenCycleIds
    .map((id) => byId.get(id))
    .filter((s): s is Row => !!s)

  const dataQuality = {
    selfReferences: selfReferences.map((s) => ({ id: s.id, name: s.name })),
    danglingPointers: danglingPointers.map((d) => ({ id: d.student.id, name: d.student.name, pointsTo: d.pointsTo })),
    mutualCycles: mutualCycles.map((s) => ({ id: s.id, name: s.name, pointsTo: s.little_angel ?? '' })),
  }

  return (
    <LittleAngelClient
      role={user!.role}
      system={system}
      kpi={kpi}
      ranking={ranking}
      countyDist={countyDist}
      dataQuality={dataQuality}
      students={all}
    />
  )
}

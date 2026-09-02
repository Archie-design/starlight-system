import { redirect } from 'next/navigation'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { applySystemFilter, systemOf } from '@/lib/utils/system'
import { parseNameWithId } from '@/lib/utils/nameUtils'
import { findSelfReferences, findDanglingAndCrossSystemPointers } from '@/lib/utils/littleAngel'
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
  gender: string | null
}

/** 跨體系比對用的最小欄位——不需要 county/gender，只為了解析對方姓名與體系 */
type MinimalRow = { id: number; name: string; business_chain: string | null }

const UNSPECIFIED_COUNTY = '未填寫'
const UNSPECIFIED_GENDER = '未填寫'

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
        .select('id, name, little_angel, business_chain, county, gender'),
      system,
    ).range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Row[]))
    if (data.length < 1000) break
  }

  // 全體系（不限有效體系）的最小學員清單，僅供資料品質區塊判斷「小天使
  // 指向的 ID 是否存在，只是屬於另一個體系」——若不查全體系，這種跨體系
  // 指派會被誤判成「查無此人」（見下方 findDanglingAndCrossSystemPointers）。
  const allSystemsStudents: MinimalRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from('students')
      .select('id, name, business_chain')
      .range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    allSystemsStudents.push(...(data as MinimalRow[]))
    if (data.length < 1000) break
  }
  const allSystemsById = new Map(allSystemsStudents.map((s) => [s.id, s]))

  // 小天使從屬關係 = little_angel 非空的學員
  const withAngel = all.filter((s) => s.little_angel)
  const byId = new Map(all.map((s) => [s.id, s]))

  // 不重複小天使 ID 集合——僅保留「本體系確實查得到對應學員」的 ID。
  // little_angel 只是純文字解析，不保證解析出的 ID 真的指向一筆存在的
  // 學員記錄（可能查無此人，或指向另一體系的人——見下方資料品質偵測）；
  // 若把這些「查無此人」的 ID 也算進「小天使人數」，KPI 數字會跟其他
  // 統計（男女比例、名單）的口徑不一致（曾實際發生：KPI 顯示 201 位，
  // 但男女比例圖只統計得到 155 位，差額正是查無此人／跨體系的 ID）。
  const angelIds = new Set<number>()
  for (const s of withAngel) {
    const { id } = parseNameWithId(s.little_angel)
    if (id !== null && byId.has(id)) angelIds.add(id)
  }

  const ledCountByAngel = new Map<number, number>()
  for (const s of withAngel) {
    const { id } = parseNameWithId(s.little_angel)
    if (id !== null) ledCountByAngel.set(id, (ledCountByAngel.get(id) ?? 0) + 1)
  }

  const kpi = {
    angelCount: angelIds.size,
    ledCount: withAngel.length,
    avgLedPerAngel: angelIds.size > 0 ? Math.round((withAngel.length / angelIds.size) * 10) / 10 : 0,
    noAngelCount: all.length - withAngel.length,
  }

  // 排行榜：各小天使（依 id）直接帶的人數，由多到少。這裡刻意不套用
  // angelIds 的「存在性」過濾——查無此人的小天使 ID 仍要顯示在排行榜
  // 上（用 (id XXXX) 表示），讓使用者能發現「有人的 little_angel 填了
  // 查無此人的 ID」這件事，而不是悄悄從排行榜消失；但不列入 KPI 的
  // 「小天使人數」統計，避免無法辨識身份的 ID 拉高看似正常的人數指標。
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

  // 小天使的男女比例與名單（統計母體是「小天使」本人，即 angelIds 對應的
  // 學員，而非被帶學員——與上面的地區分布母體不同，那個是以被帶學員統計）
  const angels = Array.from(angelIds)
    .map((id) => byId.get(id))
    .filter((s): s is Row => !!s)
  const genderMap = new Map<string, number>()
  for (const a of angels) {
    const g = (a.gender ?? '').trim() || UNSPECIFIED_GENDER
    genderMap.set(g, (genderMap.get(g) ?? 0) + 1)
  }
  const genderDist = Array.from(genderMap.entries())
    .map(([gender, count]) => ({ gender, count }))
    .sort((a, b) => b.count - a.count)
  const angelRoster = angels
    .map((a) => ({ id: a.id, name: a.name, gender: a.gender, ledCount: ledCountByAngel.get(a.id) ?? 0 }))
    .sort((a, b) => b.ledCount - a.ledCount)

  // 資料品質：自我指向、懸空指標／跨體系指派（各自獨立的檢查，見
  // lib/utils/littleAngel.ts 的說明——不能只靠 buildTree 的 brokenCycleIds，
  // 那個不含自我指向案例）
  const selfReferences = findSelfReferences(all)
  const { dangling: danglingPointers, crossSystem: crossSystemPointers } = findDanglingAndCrossSystemPointers(
    all,
    allSystemsById,
    systemOf,
  )

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
    crossSystemPointers: crossSystemPointers.map((d) => ({
      id: d.student.id,
      name: d.student.name,
      pointsTo: d.pointsTo,
      targetName: d.targetName,
      targetSystem: d.targetSystem,
    })),
  }

  return (
    <LittleAngelClient
      role={user!.role}
      system={system}
      kpi={kpi}
      ranking={ranking}
      countyDist={countyDist}
      genderDist={genderDist}
      angelRoster={angelRoster}
      dataQuality={dataQuality}
      students={all}
    />
  )
}

import { redirect } from 'next/navigation'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { applySystemFilter } from '@/lib/utils/system'
import { parseCourseValue } from '@/lib/utils/courseUtils'
import { NUMERIC } from '@/lib/utils/studentStatus'
import { APP_NAME } from '@/lib/config'
import CourseClient from './CourseClient'

export const metadata = {
  title: `課程專區 — ${APP_NAME}`,
}

type Row = {
  id: number
  name: string
  business_chain: string | null
  course_1: string | null
  payment_1: string | null
  course_2: string | null
  payment_2: string | null
  course_3: string | null
  payment_3: string | null
  course_4: string | null
  payment_4: string | null
  course_5: string | null
  payment_5: string | null
  course_wuyun: string | null
  payment_wuyun: string | null
}

/** 主課程階別（一至五階）；五運班資料無梯次概念，獨立處理，不在此清單內 */
const MAIN_STAGES = [
  { level: 1, courseField: 'course_1', paymentField: 'payment_1' },
  { level: 2, courseField: 'course_2', paymentField: 'payment_2' },
  { level: 3, courseField: 'course_3', paymentField: 'payment_3' },
  { level: 4, courseField: 'course_4', paymentField: 'payment_4' },
  { level: 5, courseField: 'course_5', paymentField: 'payment_5' },
] as const

/** 未排定具體梯次的狀態（例如「待確認梯次」）——計入階別總人數，但不進梯次分布圖 */
function owedAmount(paymentValue: string | null): number {
  if (!paymentValue) return 0
  const trimmed = paymentValue.trim()
  return NUMERIC.test(trimmed) ? Number(trimmed) : 0
}

export interface BatchRow { batchKey: string; batch: number; count: number }
export interface StageSummary {
  level: number
  label: string
  totalEnrolled: number
  batches: BatchRow[]
  owedCount: number
  owedAmount: number
}
export interface RosterStudent {
  id: number
  name: string
  statusLabel: string
  paymentLabel: string
  owes: boolean
}

const STAGE_LABELS: Record<number, string> = { 1: '一階', 2: '二階', 3: '三階', 4: '四階', 5: '五階' }

export default async function CoursesPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.must_change_password) redirect('/account/change-password')

  const system = await getEffectiveSystem(user!)
  const service = createServiceClient()

  // 分頁撈本體系全量學員（只取課程相關欄位）。務必分頁——PostgREST 預設
  // 單次查詢上限 1000 筆，若不分頁在資料量超過此數時會靜默漏資料。
  const all: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await applySystemFilter(
      service
        .from('students')
        .select('id, name, business_chain, course_1, payment_1, course_2, payment_2, course_3, payment_3, course_4, payment_4, course_5, payment_5, course_wuyun, payment_wuyun'),
      system,
    ).range(from, from + 999)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Row[]))
    if (data.length < 1000) break
  }

  // 各階（一至五階）：總人數、梯次分布、欠款人數/金額
  const stages: StageSummary[] = []
  // 名單查詢表：key 為 "level" 或 "level-batch"，value 為對應學員名單
  const roster: Record<string, RosterStudent[]> = {}

  for (const { level, courseField, paymentField } of MAIN_STAGES) {
    const enrolled = all.filter((s) => s[courseField])
    const batchMap = new Map<string, { batch: number; count: number }>()
    let owedCount = 0
    let owedTotal = 0
    const stageRoster: RosterStudent[] = []

    for (const s of enrolled) {
      const courseValue = s[courseField]
      const paymentValue = s[paymentField]
      const parsed = parseCourseValue(courseValue)
      const amount = owedAmount(paymentValue)
      const owes = amount > 0

      if (owes) {
        owedCount++
        owedTotal += amount
      }

      const statusLabel = parsed?.status ?? (courseValue ?? '')
      const paymentLabel = paymentValue ?? '—'
      const rosterEntry: RosterStudent = { id: s.id, name: s.name, statusLabel, paymentLabel, owes }
      stageRoster.push(rosterEntry)

      if (parsed?.batch != null) {
        const batchKey = `${level}-${parsed.batch}`
        const bucket = batchMap.get(batchKey) ?? { batch: parsed.batch, count: 0 }
        bucket.count++
        batchMap.set(batchKey, bucket)

        if (!roster[batchKey]) roster[batchKey] = []
        roster[batchKey].push(rosterEntry)
      }
    }

    roster[String(level)] = stageRoster

    const batches: BatchRow[] = Array.from(batchMap.entries())
      .map(([batchKey, { batch, count }]) => ({ batchKey, batch, count }))
      .sort((a, b) => a.batch - b.batch)

    stages.push({
      level,
      label: STAGE_LABELS[level],
      totalEnrolled: enrolled.length,
      batches,
      owedCount,
      owedAmount: owedTotal,
    })
  }

  // 五運班：僅付款統計，無梯次分布
  const wuyunEnrolled = all.filter((s) => s.course_wuyun)
  let wuyunOwedCount = 0
  let wuyunOwedTotal = 0
  let wuyunCompletedCount = 0
  const wuyunRoster: RosterStudent[] = []
  for (const s of wuyunEnrolled) {
    const amount = owedAmount(s.payment_wuyun)
    const owes = amount > 0
    if (owes) {
      wuyunOwedCount++
      wuyunOwedTotal += amount
    }
    if ((s.payment_wuyun ?? '').trim() === '完款') wuyunCompletedCount++
    wuyunRoster.push({
      id: s.id,
      name: s.name,
      statusLabel: s.course_wuyun ?? '',
      paymentLabel: s.payment_wuyun ?? '—',
      owes,
    })
  }
  roster['wuyun'] = wuyunRoster

  const wuyunSummary = {
    totalEnrolled: wuyunEnrolled.length,
    completedCount: wuyunCompletedCount,
    owedCount: wuyunOwedCount,
    owedAmount: wuyunOwedTotal,
  }

  return (
    <CourseClient
      role={user!.role}
      system={system}
      stages={stages}
      wuyunSummary={wuyunSummary}
      roster={roster}
    />
  )
}

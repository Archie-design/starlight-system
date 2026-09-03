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
  phone: string | null
  line_id: string | null
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
  l1_makeup_1: string | null
  l1_makeup_2: string | null
  l1_makeup_3: string | null
  l1_makeup_4: string | null
  l1_makeup_5: string | null
  l1_makeup_6: string | null
  l2_makeup_1: string | null
  l2_makeup_2: string | null
  l2_makeup_3: string | null
  l2_makeup_4: string | null
  l2_makeup_5: string | null
  l3_makeup_1: string | null
  l3_makeup_2: string | null
  l3_makeup_3: string | null
  l4_makeup_1: string | null
  l4_makeup_2: string | null
  l4_makeup_3: string | null
  l5_makeup_1: string | null
  club_join_date: string | null
  club_group: string | null
}

/** 主課程階別（一至五階）；五運班資料無梯次概念，獨立處理，不在此清單內 */
const MAIN_STAGES = [
  { level: 1, courseField: 'course_1', paymentField: 'payment_1' },
  { level: 2, courseField: 'course_2', paymentField: 'payment_2' },
  { level: 3, courseField: 'course_3', paymentField: 'payment_3' },
  { level: 4, courseField: 'course_4', paymentField: 'payment_4' },
  { level: 5, courseField: 'course_5', paymentField: 'payment_5' },
] as const

/**
 * 各階課後課欄位定義（field 名 + 顯示用堂名 + 是否為同學會），堂數不對稱
 * 依實際來源檔案而定。`isReunion` 標記「同學會」這堂——它在每階都存在，
 * 但性質是聯誼/回訪性質而非正式課程內容，解圓夢計劃資格等以「正式課後課
 * 堂數」為門檻的規則需要排除它，用顯式欄位標記比用 label 字串比對穩健。
 *
 * 「上級貴人成功學」（l1_makeup_5）目前已停開，故不列入此完課率統計清單——
 * 但 l1_makeup_5 欄位本身、匯入邏輯、既有出席歷史資料完全不動，只是不再
 * 計入「已上主課者需上滿幾堂」的統計母體與完課率計算。若未來這堂課恢復
 * 開課，把這行加回來即可，不需要任何遷移或資料修復。
 */
const MAKEUP_CLASSES: Record<number, { field: keyof Row; label: string; isReunion?: boolean }[]> = {
  1: [
    { field: 'l1_makeup_1', label: '同學會', isReunion: true },
    { field: 'l1_makeup_2', label: '我喜歡/討厭自己的原因' },
    { field: 'l1_makeup_3', label: '上平下緣傳愛道' },
    { field: 'l1_makeup_4', label: '對好心沒好報的誤解' },
    { field: 'l1_makeup_6', label: '金錢的助流' },
  ],
  2: [
    { field: 'l2_makeup_1', label: '同學會', isReunion: true },
    { field: 'l2_makeup_2', label: '解脫痛苦之道' },
    { field: 'l2_makeup_3', label: '道命之路成功秘訣' },
    { field: 'l2_makeup_4', label: '動中之靜煉金術(修靜)' },
    { field: 'l2_makeup_5', label: '痛的參解' },
  ],
  3: [
    { field: 'l3_makeup_1', label: '同學會', isReunion: true },
    { field: 'l3_makeup_2', label: '平衡力開運法' },
    { field: 'l3_makeup_3', label: '懺悔寬恕寶藏圖' },
  ],
  4: [
    { field: 'l4_makeup_1', label: '同學會', isReunion: true },
    { field: 'l4_makeup_2', label: '突破陰暗面' },
    { field: 'l4_makeup_3', label: '陰陽智慧的奇蹟(批評、欣賞)' },
  ],
  5: [
    { field: 'l5_makeup_1', label: '同學會', isReunion: true },
  ],
}

/** 解圓夢計劃資格門檻：一階已完課者，上完一階（不含同學會）課後課的堂數達此數以上即符合資格 */
const DREAM_PROGRAM_THRESHOLD = 3

/** 未排定具體梯次的狀態（例如「待確認梯次」）——計入階別總人數，但不進梯次分布圖 */
function owedAmount(paymentValue: string | null): number {
  if (!paymentValue) return 0
  const trimmed = paymentValue.trim()
  return NUMERIC.test(trimmed) ? Number(trimmed) : 0
}

export interface BatchRow { batchKey: string; batch: number; count: number }
export interface MakeupClassSummary {
  /** 名單查詢 key，格式 "makeup-{level}-{index}" */
  rosterKey: string
  label: string
  attendedCount: number
}
export interface StageSummary {
  level: number
  label: string
  totalEnrolled: number
  batches: BatchRow[]
  owedCount: number
  owedAmount: number
  /** 完課率統計母體：已上主課者（course_N 有值）當中，已上「全部」課後課的人數 */
  completedMainCourseCount: number
  fullyAttendedMakeupCount: number
  makeupClasses: MakeupClassSummary[]
  /** 未全部完課人數（completedMainCourseCount - fullyAttendedMakeupCount），
   *  名單 key 為 `roster["incomplete-makeup-{level}"]`；只有本階有課後課
   *  （makeupClasses.length > 0）時才有意義 */
  incompleteMakeupCount: number
}
export interface RosterStudent {
  id: number
  name: string
  /** 手機（供關懷員聯繫用，可能為空） */
  phone: string | null
  /** LINE ID（供關懷員聯繫用，可能為空） */
  lineId: string | null
  statusLabel: string
  paymentLabel: string
  owes: boolean
}
export interface ClubSummary {
  joinedCount: number
  notJoinedCount: number
  groupDist: { group: string; count: number }[]
}
export interface L2ClubGap {
  l2CompletedCount: number
  notJoinedCount: number
}
export interface L1DreamProgram {
  l1CompletedCount: number
  qualifiedCount: number
  /** 資格門檻堂數（目前為 3），與 roster 名單的計算共用同一個常數，避免前端硬編另一份數字 */
  threshold: number
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
        .select('id, name, phone, line_id, business_chain, course_1, payment_1, course_2, payment_2, course_3, payment_3, course_4, payment_4, course_5, payment_5, course_wuyun, payment_wuyun, l1_makeup_1, l1_makeup_2, l1_makeup_3, l1_makeup_4, l1_makeup_5, l1_makeup_6, l2_makeup_1, l2_makeup_2, l2_makeup_3, l2_makeup_4, l2_makeup_5, l3_makeup_1, l3_makeup_2, l3_makeup_3, l4_makeup_1, l4_makeup_2, l4_makeup_3, l5_makeup_1, club_join_date, club_group'),
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
      const rosterEntry: RosterStudent = { id: s.id, name: s.name, phone: s.phone, lineId: s.line_id, statusLabel, paymentLabel, owes }
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

    // 完課率：統計母體是「已上主課者」（enrolled），對每堂課後課分別統計
    // 出席（有值）與缺席（無值）名單；「已上全部堂數」則是每堂都出席的人數。
    const classes = MAKEUP_CLASSES[level] ?? []
    const makeupClasses: MakeupClassSummary[] = []
    let fullyAttendedCount = 0

    for (let i = 0; i < classes.length; i++) {
      const { field, label } = classes[i]
      const rosterKey = `makeup-${level}-${i}`
      const attendedRoster: RosterStudent[] = []
      const absentRoster: RosterStudent[] = []
      for (const s of enrolled) {
        const value = s[field] as string | null
        const entry: RosterStudent = { id: s.id, name: s.name, phone: s.phone, lineId: s.line_id, statusLabel: value ?? '未出席', paymentLabel: '', owes: false }
        if (value) attendedRoster.push(entry)
        else absentRoster.push(entry)
      }
      roster[rosterKey] = attendedRoster
      roster[`${rosterKey}-absent`] = absentRoster
      makeupClasses.push({ rosterKey, label, attendedCount: attendedRoster.length })
    }

    // 未全部完課名單：已上主課、但至少一堂課後課還沒上——與各別單堂緣缺
    // 名單不同，這是「整體視角」，方便一次找出需要逐一鼓勵的對象。
    // statusLabel 帶出「已上 X / 總堂數」方便排優先順序（缺越多堂的越優先）。
    const incompleteRoster: RosterStudent[] = []
    if (classes.length > 0) {
      for (const s of enrolled) {
        const attendedCount = classes.filter(({ field }) => !!s[field]).length
        const allAttended = attendedCount === classes.length
        if (allAttended) {
          fullyAttendedCount++
        } else {
          incompleteRoster.push({
            id: s.id,
            name: s.name,
            phone: s.phone,
            lineId: s.line_id,
            statusLabel: `已上 ${attendedCount} / ${classes.length} 堂`,
            paymentLabel: '',
            owes: false,
          })
        }
      }
      roster[`incomplete-makeup-${level}`] = incompleteRoster
    }

    stages.push({
      level,
      label: STAGE_LABELS[level],
      totalEnrolled: enrolled.length,
      batches,
      owedCount,
      owedAmount: owedTotal,
      completedMainCourseCount: enrolled.length,
      fullyAttendedMakeupCount: fullyAttendedCount,
      makeupClasses,
      incompleteMakeupCount: incompleteRoster.length,
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
      phone: s.phone,
      lineId: s.line_id,
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

  // 聯誼會報名統計：join date 有值即代表已報名（比照 spirit_ambassador_join_date
  // 判斷「是否為心之使者」的既有模式）。統計母體為本體系全量學員，非僅
  // 某一階報名者——聯誼會報名與課程階別是各自獨立的維度。
  const clubJoined = all.filter((s) => s.club_join_date)
  const clubGroupMap = new Map<string, number>()
  for (const s of clubJoined) {
    const g = (s.club_group ?? '').trim() || '未分組'
    clubGroupMap.set(g, (clubGroupMap.get(g) ?? 0) + 1)
  }
  roster['club-joined'] = clubJoined.map((s) => ({ id: s.id, name: s.name, phone: s.phone, lineId: s.line_id, statusLabel: s.club_join_date ?? '', paymentLabel: s.club_group ?? '未分組', owes: false }))
  const clubSummary: ClubSummary = {
    joinedCount: clubJoined.length,
    notJoinedCount: all.length - clubJoined.length,
    groupDist: Array.from(clubGroupMap.entries()).map(([group, count]) => ({ group, count })).sort((a, b) => b.count - a.count),
  }

  // 二階已完課（course_2 狀態精確為「已上課」，排除正取/候補/待確認梯次等
  // 尚未實際上課的狀態）但尚未報名聯誼會（club_join_date 為空）的交集名單。
  // 「完課」用 parseCourseValue().status === '已上課' 判斷，比「course_2
  // 有值」更精確——見與使用者的確認：報名/候補中的人不該被當成已完課。
  const l2Completed = all.filter((s) => {
    const parsed = parseCourseValue(s.course_2)
    return parsed?.status === '已上課'
  })
  const l2CompletedNotJoinedClub = l2Completed.filter((s) => !s.club_join_date)
  roster['club-not-joined-l2'] = l2CompletedNotJoinedClub.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    lineId: s.line_id,
    statusLabel: '二階已完課',
    paymentLabel: '未報名聯誼會',
    owes: false,
  }))
  const l2ClubGap = {
    l2CompletedCount: l2Completed.length,
    notJoinedCount: l2CompletedNotJoinedClub.length,
  }

  // 解圓夢計劃資格：一階已完課（course_1 精確為「已上課」，判定標準與
  // 二階/聯誼會交集查詢一致）且額外上完 3 堂以上一階課後課（不含同學會）
  // 者符合資格。範圍僅限一階本身的課後課，不跨階別加總；同學會用
  // MAKEUP_CLASSES 的 isReunion 標記排除，而非用 label 字串比對。
  const l1Completed = all.filter((s) => {
    const parsed = parseCourseValue(s.course_1)
    return parsed?.status === '已上課'
  })
  const l1NonReunionClasses = (MAKEUP_CLASSES[1] ?? []).filter((c) => !c.isReunion)
  const l1DreamQualified = l1Completed.filter((s) => {
    const attendedCount = l1NonReunionClasses.filter(({ field }) => !!s[field]).length
    return attendedCount >= DREAM_PROGRAM_THRESHOLD
  })
  roster['l1-dream-program'] = l1DreamQualified.map((s) => {
    const attendedCount = l1NonReunionClasses.filter(({ field }) => !!s[field]).length
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      lineId: s.line_id,
      statusLabel: `已上 ${attendedCount} 堂（不含同學會）`,
      paymentLabel: '符合解圓夢計劃資格',
      owes: false,
    }
  })
  const l1DreamProgram: L1DreamProgram = {
    l1CompletedCount: l1Completed.length,
    qualifiedCount: l1DreamQualified.length,
    threshold: DREAM_PROGRAM_THRESHOLD,
  }

  return (
    <CourseClient
      role={user!.role}
      system={system}
      stages={stages}
      wuyunSummary={wuyunSummary}
      clubSummary={clubSummary}
      l2ClubGap={l2ClubGap}
      l1DreamProgram={l1DreamProgram}
      roster={roster}
    />
  )
}

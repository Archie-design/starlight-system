import type { Student } from '@/lib/supabase/types'

/**
 * 學員狀態判定（單一事實來源）。
 *
 * 欄位語意（經實際資料探索確認）：
 * - 付款欄填「純數字」= 還欠的金額（未繳清）；填「完款」字樣 = 已繳清
 * - 課程欄「待確認梯次」= 已報名但未排課；具體梯次字串 = 已實際上課
 *
 * 這些判定同時供查詢層（repository）與篩選/匯出重用，未來欄位語意若改只需改此處。
 */

export type MembershipStatus = 'expired' | 'in30' | 'in90' | 'valid' | 'none'

/** 六個階段的 (課程欄, 付款欄) 對照（含五運，用於欠款判定） */
export const STAGE_KEYS: Array<{ course: keyof Student; payment: keyof Student }> = [
  { course: 'course_1', payment: 'payment_1' },
  { course: 'course_2', payment: 'payment_2' },
  { course: 'course_3', payment: 'payment_3' },
  { course: 'course_4', payment: 'payment_4' },
  { course: 'course_5', payment: 'payment_5' },
  { course: 'course_wuyun', payment: 'payment_wuyun' },
]

const NEWBIE_DAYS = 30

/** 最高完成階別：0（未上課）~ 5 */
export function highestStage(s: Pick<Student, 'course_1' | 'course_2' | 'course_3' | 'course_4' | 'course_5'>): 0 | 1 | 2 | 3 | 4 | 5 {
  let top: 0 | 1 | 2 | 3 | 4 | 5 = 0
  ;([s.course_1, s.course_2, s.course_3, s.course_4, s.course_5]).forEach((c, i) => {
    if (c) top = (i + 1) as 1 | 2 | 3 | 4 | 5
  })
  return top
}

/** 會籍狀態（依 membership_expiry 與 now 比較） */
export function membershipStatus(expiry: string | null, now: number = Date.now()): MembershipStatus {
  if (!expiry) return 'none'
  const day = 1000 * 60 * 60 * 24
  const diff = Math.ceil((new Date(expiry).getTime() - now) / day)
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'in30'
  if (diff <= 90) return 'in90'
  return 'valid'
}

/** 是否為心之使者 */
export function isSpirit(s: Pick<Student, 'spirit_ambassador_join_date'>): boolean {
  return !!s.spirit_ambassador_join_date
}

/** 是否為近 30 天新建檔 */
export function isNewbie(s: Pick<Student, 'created_at'>, now: number = Date.now()): boolean {
  if (!s.created_at) return false
  const day = 1000 * 60 * 60 * 24
  const ageDays = Math.ceil((now - new Date(s.created_at).getTime()) / day)
  return ageDays <= NEWBIE_DAYS
}

/**
 * 續報潛力：上完某階 N（1~4）但未上 N+1 階。
 * （第 5 階為最高階，無下一階，故只看 1~4）
 */
export function isResubscribeCandidate(
  s: Pick<Student, 'course_1' | 'course_2' | 'course_3' | 'course_4' | 'course_5'>
): boolean {
  const c = [s.course_1, s.course_2, s.course_3, s.course_4, s.course_5].map((x) => !!x)
  for (let i = 0; i < 4; i++) {
    if (c[i] && !c[i + 1]) return true
  }
  return false
}

const NUMERIC = /^\d+(\.\d+)?$/

/**
 * 待催欠款：存在某階「已排具體梯次」（課程欄非空、非「待確認梯次」）
 * 但付款欄為純數字（= 還欠金額）。
 */
export function owesPayment(s: Student): boolean {
  for (const { course, payment } of STAGE_KEYS) {
    const cv = (s[course] as string | null)?.trim() ?? ''
    const pv = (s[payment] as string | null)?.trim() ?? ''
    if (cv && cv !== '待確認梯次' && NUMERIC.test(pv)) return true
  }
  return false
}

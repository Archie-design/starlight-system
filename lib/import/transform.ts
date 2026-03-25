import { buildCourseValue, buildPaymentValue } from '@/lib/utils/courseUtils'
import { normalizeDate } from '@/lib/utils/dateUtils'
import { parseNameWithId } from '@/lib/utils/nameUtils'
import type { StudentInsert } from '@/lib/supabase/types'

/**
 * 來源欄位索引 (1-based, 對應 學員關懷傘下學員報課狀況.xlsx)
 */
const COL = {
  SYSTEM_ID: 1,
  STUDENT_ID: 2,
  FULL_NAME: 3,
  ROLE: 4,
  GENDER: 5,
  PHONE: 14,
  LINE_ID: 15,
  INTRODUCER: 16,
  LITTLE_ANGEL: 21,
  CHUAN_AI_SYSTEM: 23,
  COUNSELOR: 24,
  REGION: 25,
  GUIDANCE_CHAIN: 26,
  SENIOR_COUNSELOR: 27,
  CLUB_MEMBERSHIP: 29,
  // 一階 (35-42)
  L1_BATCH: 35, L1_STATUS: 36, L1_PARENT: 39, L1_PAY_STATUS: 41, L1_BALANCE: 42,
  // 二階 (43-50)
  L2_BATCH: 43, L2_STATUS: 44, L2_PAY_STATUS: 49, L2_BALANCE: 50,
  // 三階 (51-58)
  L3_BATCH: 51, L3_STATUS: 52, L3_PAY_STATUS: 57, L3_BALANCE: 58,
  // 四階 (59-66)
  L4_BATCH: 59, L4_STATUS: 60, L4_PAY_STATUS: 65, L4_BALANCE: 66,
  // 五階 (67-74)
  L5_BATCH: 67, L5_STATUS: 68, L5_PAY_STATUS: 73, L5_BALANCE: 74,
  // 五運班
  WUYUN_AMOUNT: 75, WUYUN_PAY_STATUS: 76,
  WUYUN_A: 78, WUYUN_B: 80, WUYUN_C: 82, WUYUN_D: 84, WUYUN_F: 88,
  // 特殊課程
  LIFE_NUMBERS: 90,
  LIFE_NUMBERS_ADV: 91,
  LIFE_TRANSFORM: 92,
  DREAM_INTERPRETER: 93,
  DEBT_RELEASE: 114,
} as const

type RawRow = (string | number | Date | null | undefined)[]

/**
 * 將來源 xlsx 的一列資料轉換為 students 表格格式
 */
export function transformSourceRow(row: RawRow): StudentInsert | null {
  const get = (col: number) => row[col - 1] ?? null

  const fullName = get(COL.FULL_NAME)
  if (!fullName) return null

  const name = String(fullName).trim()
  if (!name) return null

  // 優先用系統編號欄 (col 1)；若不存在則嘗試從全名解析 "568_王晴臻" 格式
  const rawSystemId = get(COL.SYSTEM_ID)
  const { id: parsedId } = parseNameWithId(String(fullName))
  const id = rawSystemId ? Number(rawSystemId) : parsedId
  if (!id) return null

  const guidanceChain = get(COL.GUIDANCE_CHAIN)
  let sheetSystem: '星光' | '太陽' = '星光'
  if (guidanceChain && String(guidanceChain).includes('太陽')) {
    sheetSystem = '太陽'
  }

  // 社團會籍日期正規化
  const membershipRaw = get(COL.CLUB_MEMBERSHIP)
  const membershipDate = normalizeDate(membershipRaw as Date | string | null)
  const membershipExpiry = membershipDate
    ? membershipDate.toISOString().split('T')[0]
    : null

  return {
    id,
    name,
    gender: get(COL.GENDER) ? String(get(COL.GENDER)) : null,
    role: get(COL.ROLE) ? String(get(COL.ROLE)) : null,
    sheet_system: sheetSystem,
    phone: get(COL.PHONE) ? String(get(COL.PHONE)) : null,
    line_id: get(COL.LINE_ID) ? String(get(COL.LINE_ID)) : null,
    introducer: get(COL.INTRODUCER) ? String(get(COL.INTRODUCER)) : null,
    relation: null,
    business_chain: get(COL.CHUAN_AI_SYSTEM) ? String(get(COL.CHUAN_AI_SYSTEM)) : null,
    counselor: get(COL.COUNSELOR) ? String(get(COL.COUNSELOR)) : null,
    little_angel: get(COL.LITTLE_ANGEL) ? String(get(COL.LITTLE_ANGEL)) : null,
    dream_interpreter: get(COL.DREAM_INTERPRETER) ? String(get(COL.DREAM_INTERPRETER)) : null,
    senior_counselor: get(COL.SENIOR_COUNSELOR) ? String(get(COL.SENIOR_COUNSELOR)) : null,
    region: get(COL.REGION) ? String(get(COL.REGION)) : null,
    guidance_chain: guidanceChain ? String(guidanceChain) : null,
    membership_expiry: membershipExpiry,
    // 各階課程
    course_1: buildCourseValue(1, get(COL.L1_BATCH) as number, get(COL.L1_STATUS) as string),
    payment_1: buildPaymentValue(get(COL.L1_PAY_STATUS) as string, get(COL.L1_BALANCE) as number),
    parent_1: get(COL.L1_PARENT) ? String(get(COL.L1_PARENT)) : null,
    course_2: buildCourseValue(2, get(COL.L2_BATCH) as number, get(COL.L2_STATUS) as string),
    payment_2: buildPaymentValue(get(COL.L2_PAY_STATUS) as string, get(COL.L2_BALANCE) as number),
    course_3: buildCourseValue(3, get(COL.L3_BATCH) as number, get(COL.L3_STATUS) as string),
    payment_3: buildPaymentValue(get(COL.L3_PAY_STATUS) as string, get(COL.L3_BALANCE) as number),
    course_4: buildCourseValue(4, get(COL.L4_BATCH) as number, get(COL.L4_STATUS) as string),
    payment_4: buildPaymentValue(get(COL.L4_PAY_STATUS) as string, get(COL.L4_BALANCE) as number),
    course_5: buildCourseValue(5, get(COL.L5_BATCH) as number, get(COL.L5_STATUS) as string),
    payment_5: buildPaymentValue(get(COL.L5_PAY_STATUS) as string, get(COL.L5_BALANCE) as number),
    course_wuyun: buildPaymentValue(get(COL.WUYUN_PAY_STATUS) as string, get(COL.WUYUN_AMOUNT) as number) ? '五運' : null,
    payment_wuyun: buildPaymentValue(get(COL.WUYUN_PAY_STATUS) as string, get(COL.WUYUN_AMOUNT) as number),
    wuyun_a: get(COL.WUYUN_A) ? String(get(COL.WUYUN_A)) : null,
    wuyun_b: get(COL.WUYUN_B) ? String(get(COL.WUYUN_B)) : null,
    wuyun_c: get(COL.WUYUN_C) ? String(get(COL.WUYUN_C)) : null,
    wuyun_d: get(COL.WUYUN_D) ? String(get(COL.WUYUN_D)) : null,
    wuyun_f: get(COL.WUYUN_F) ? String(get(COL.WUYUN_F)) : null,
    life_numbers: get(COL.LIFE_NUMBERS) ? String(get(COL.LIFE_NUMBERS)) : null,
    life_numbers_advanced: get(COL.LIFE_NUMBERS_ADV) ? String(get(COL.LIFE_NUMBERS_ADV)) : null,
    life_transform: get(COL.LIFE_TRANSFORM) ? String(get(COL.LIFE_TRANSFORM)) : null,
    debt_release: get(COL.DEBT_RELEASE) ? String(get(COL.DEBT_RELEASE)) : null,
    last_synced_at: new Date().toISOString(),
    system_id: get(COL.SYSTEM_ID) ? Number(get(COL.SYSTEM_ID)) : null,
  }
}

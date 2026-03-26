import { buildCourseValue, buildPaymentValue } from '@/lib/utils/courseUtils'
import { normalizeDate } from '@/lib/utils/dateUtils'
import { parseNameWithId } from '@/lib/utils/nameUtils'
import type { StudentInsert } from '@/lib/supabase/types'

/**
 * 預設來源欄位索引 (1-based, 對應最新 學員資料庫 20260325.xlsx)
 */
export const DEFAULT_COL = {
  FULL_NAME: 1,
  SYSTEM_ID: 2,
  STUDENT_ID: 3,
  ROLE: 4,
  GENDER: 6,
  PHONE: 10,
  LINE_ID: 19,
  INTRODUCER: 20,
  LITTLE_ANGEL: 28,
  CHUAN_AI_SYSTEM: 25,
  COUNSELOR: 27,
  REGION: 30,
  GUIDANCE_CHAIN: 31,
  SENIOR_COUNSELOR: 26,
  CLUB_MEMBERSHIP: 44,
  DREAM_INTERPRETER: 29,
  // 一階
  L1_BATCH: 52, L1_STATUS: 53, L1_PARENT: 55, L1_PAY_STATUS: 56, L1_BALANCE: 58,
  // 二階
  L2_BATCH: 59, L2_STATUS: 60, L2_PAY_STATUS: 63, L2_BALANCE: 65,
  // 三階
  L3_BATCH: 66, L3_STATUS: 67, L3_PAY_STATUS: 70, L3_BALANCE: 72,
  // 四階
  L4_BATCH: 73, L4_STATUS: 74, L4_PAY_STATUS: 77, L4_BALANCE: 79,
  // 五階
  L5_BATCH: 80, L5_STATUS: 81, L5_PAY_STATUS: 84, L5_BALANCE: 86,
  // 五運班
  WUYUN_PAY_STATUS: 87, WUYUN_AMOUNT: 88,
  WUYUN_A: 90, WUYUN_B: 91, WUYUN_C: 92, WUYUN_D: 93, WUYUN_F: 95,
  // 特殊課程
  LIFE_NUMBERS: 96,
  LIFE_NUMBERS_ADV: 97,
  LIFE_TRANSFORM: 98,
  DEBT_RELEASE: 119,
  // 心之使者
  SPIRIT_AMBASSADOR_JOIN_DATE: 46,
  LOVE_GIVING_START_DATE: 47,
  SPIRIT_AMBASSADOR_GROUP: 48,
  CUMULATIVE_SENIORITY: 49,
} as const

export type ColMap = Record<keyof typeof DEFAULT_COL, number>

/**
 * 標題名稱與欄位 Key 的對應關係，用於動態偵測索引
 */
export const HEADER_TO_COL_KEY: Record<string, keyof ColMap> = {
  "全名": "FULL_NAME",
  "系統編號": "SYSTEM_ID",
  "學員編號": "STUDENT_ID",
  "身份": "ROLE",
  "生理性別": "GENDER",
  "手機號碼": "PHONE",
  "LINE ID": "LINE_ID",
  "介紹人": "INTRODUCER",
  "小天使": "LITTLE_ANGEL",
  "傳愛體系": "CHUAN_AI_SYSTEM",
  "輔導員": "COUNSELOR",
  "輔導區域": "REGION",
  "輔導體系": "GUIDANCE_CHAIN",
  "傳愛領袖": "SENIOR_COUNSELOR",
  "聯誼會籍": "CLUB_MEMBERSHIP",
  "圓夢解盤": "DREAM_INTERPRETER",
  // 一至五階
  "一階 梯次": "L1_BATCH", "一階 狀態": "L1_STATUS", "一階 大堂課家長": "L1_PARENT", "一階 付款狀態": "L1_PAY_STATUS", "一階 餘額": "L1_BALANCE",
  "二階 梯次": "L2_BATCH", "二階 狀態": "L2_STATUS", "二階 付款狀態": "L2_PAY_STATUS", "二階 餘額": "L2_BALANCE",
  "三階 梯次": "L3_BATCH", "三階 狀態": "L3_STATUS", "三階 付款狀態": "L3_PAY_STATUS", "三階 餘額": "L3_BALANCE",
  "四階 梯次": "L4_BATCH", "四階 狀態": "L4_STATUS", "四階 付款狀態": "L4_PAY_STATUS", "四階 餘額": "L4_BALANCE",
  "五階 梯次": "L5_BATCH", "五階 狀態": "L5_STATUS", "五階 付款狀態": "L5_PAY_STATUS", "五階 餘額": "L5_BALANCE",
  // 五運
  "五運班 付款狀態": "WUYUN_PAY_STATUS", "五運班 已付金額": "WUYUN_AMOUNT",
  "五運班-A 出席狀態": "WUYUN_A", "五運班-B 出席狀態": "WUYUN_B", "五運班-C 出席狀態": "WUYUN_C",
  "五運班-D 出席狀態": "WUYUN_D", "五運班-F 出席狀態": "WUYUN_F",
  // 特殊
  "生命數字 出席狀態": "LIFE_NUMBERS",
  "生命數字實戰班 出席狀態": "LIFE_NUMBERS_ADV",
  "生命蛻變 出席狀態": "LIFE_TRANSFORM",
  "生生世世告別負債": "DEBT_RELEASE",
  // 心之使者
  "心之使者加入日": "SPIRIT_AMBASSADOR_JOIN_DATE",
  "大愛付出起始日": "LOVE_GIVING_START_DATE",
  "心之使者組別": "SPIRIT_AMBASSADOR_GROUP",
  "累積年資": "CUMULATIVE_SENIORITY",
}

type RawRow = (string | number | Date | null | undefined)[]

/**
 * 將來源 xlsx 的一列資料轉換為 students 表格格式
 */
export function transformSourceRow(row: RawRow, colMap: ColMap = DEFAULT_COL as any): StudentInsert | null {
  const get = (col: number) => row[col - 1] ?? null

  const fullName = get(colMap.FULL_NAME)
  if (!fullName) return null

  const name = String(fullName).trim()
  if (!name) return null

  const rawSystemId = get(colMap.SYSTEM_ID)
  const { id: parsedId } = parseNameWithId(String(fullName))
  const id = rawSystemId ? Number(rawSystemId) : parsedId
  if (!id) return null

  const guidanceChain = get(colMap.GUIDANCE_CHAIN)
  const sheetSystem: '星光' | '太陽' = '星光'

  const membershipRaw = get(colMap.CLUB_MEMBERSHIP)
  const membershipDate = normalizeDate(membershipRaw as Date | string | null)
  const membershipExpiry = membershipDate
    ? membershipDate.toISOString().split('T')[0]
    : null

  return {
    id,
    name,
    gender: get(colMap.GENDER) ? String(get(colMap.GENDER)) : null,
    role: get(colMap.ROLE) ? String(get(colMap.ROLE)) : null,
    sheet_system: sheetSystem,
    phone: get(colMap.PHONE) ? String(get(colMap.PHONE)) : null,
    line_id: get(colMap.LINE_ID) ? String(get(colMap.LINE_ID)) : null,
    introducer: get(colMap.INTRODUCER) ? String(get(colMap.INTRODUCER)) : null,
    relation: null,
    business_chain: get(colMap.CHUAN_AI_SYSTEM) ? String(get(colMap.CHUAN_AI_SYSTEM)) : null,
    counselor: get(colMap.COUNSELOR) ? String(get(colMap.COUNSELOR)) : null,
    little_angel: get(colMap.LITTLE_ANGEL) ? String(get(colMap.LITTLE_ANGEL)) : null,
    dream_interpreter: get(colMap.DREAM_INTERPRETER) ? String(get(colMap.DREAM_INTERPRETER)) : null,
    senior_counselor: get(colMap.SENIOR_COUNSELOR) ? String(get(colMap.SENIOR_COUNSELOR)) : null,
    region: get(colMap.REGION) ? String(get(colMap.REGION)) : null,
    guidance_chain: guidanceChain ? String(guidanceChain) : null,
    membership_expiry: membershipExpiry,
    course_1: buildCourseValue(1, get(colMap.L1_BATCH) as number, get(colMap.L1_STATUS) as string),
    payment_1: buildPaymentValue(get(colMap.L1_PAY_STATUS) as string, get(colMap.L1_BALANCE) as number),
    parent_1: get(colMap.L1_PARENT) ? String(get(colMap.L1_PARENT)) : null,
    course_2: buildCourseValue(2, get(colMap.L2_BATCH) as number, get(colMap.L2_STATUS) as string),
    payment_2: buildPaymentValue(get(colMap.L2_PAY_STATUS) as string, get(colMap.L2_BALANCE) as number),
    course_3: buildCourseValue(3, get(colMap.L3_BATCH) as number, get(colMap.L3_STATUS) as string),
    payment_3: buildPaymentValue(get(colMap.L3_PAY_STATUS) as string, get(colMap.L3_BALANCE) as number),
    course_4: buildCourseValue(4, get(colMap.L4_BATCH) as number, get(colMap.L4_STATUS) as string),
    payment_4: buildPaymentValue(get(colMap.L4_PAY_STATUS) as string, get(colMap.L4_BALANCE) as number),
    course_5: buildCourseValue(5, get(colMap.L5_BATCH) as number, get(colMap.L5_STATUS) as string),
    payment_5: buildPaymentValue(get(colMap.L5_PAY_STATUS) as string, get(colMap.L5_BALANCE) as number),
    course_wuyun: buildPaymentValue(get(colMap.WUYUN_PAY_STATUS) as string, get(colMap.WUYUN_AMOUNT) as number) ? '五運' : null,
    payment_wuyun: buildPaymentValue(get(colMap.WUYUN_PAY_STATUS) as string, get(colMap.WUYUN_AMOUNT) as number),
    wuyun_a: get(colMap.WUYUN_A) ? String(get(colMap.WUYUN_A)) : null,
    wuyun_b: get(colMap.WUYUN_B) ? String(get(colMap.WUYUN_B)) : null,
    wuyun_c: get(colMap.WUYUN_C) ? String(get(colMap.WUYUN_C)) : null,
    wuyun_d: get(colMap.WUYUN_D) ? String(get(colMap.WUYUN_D)) : null,
    wuyun_f: get(colMap.WUYUN_F) ? String(get(colMap.WUYUN_F)) : null,
    life_numbers: get(colMap.LIFE_NUMBERS) ? String(get(colMap.LIFE_NUMBERS)) : null,
    life_numbers_advanced: get(colMap.LIFE_NUMBERS_ADV) ? String(get(colMap.LIFE_NUMBERS_ADV)) : null,
    life_transform: get(colMap.LIFE_TRANSFORM) ? String(get(colMap.LIFE_TRANSFORM)) : null,
    debt_release: get(colMap.DEBT_RELEASE) ? String(get(colMap.DEBT_RELEASE)) : null,
    spirit_ambassador_join_date: (() => {
      const d = normalizeDate(get(colMap.SPIRIT_AMBASSADOR_JOIN_DATE) as Date | string | null)
      return d ? d.toISOString().split('T')[0] : null
    })(),
    love_giving_start_date: (() => {
      const d = normalizeDate(get(colMap.LOVE_GIVING_START_DATE) as Date | string | null)
      return d ? d.toISOString().split('T')[0] : null
    })(),
    spirit_ambassador_group: get(colMap.SPIRIT_AMBASSADOR_GROUP) ? String(get(colMap.SPIRIT_AMBASSADOR_GROUP)) : null,
    cumulative_seniority: get(colMap.CUMULATIVE_SENIORITY) ? String(get(colMap.CUMULATIVE_SENIORITY)) : null,
    last_synced_at: new Date().toISOString(),
    system_id: get(colMap.SYSTEM_ID) ? Number(get(colMap.SYSTEM_ID)) : null,
  }
}

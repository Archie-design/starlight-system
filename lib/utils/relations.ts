import type { OrgStudent } from '@/lib/utils/buildTree'
import { parseCourseValue } from '@/lib/utils/courseUtils'

/** 課程階別中文標籤 */
const STAGE_LABEL: Record<number, string> = {
  1: '一階', 2: '二階', 3: '三階', 4: '四階', 5: '五階',
}

const COURSE_FIELDS: Array<keyof OrgStudent> = [
  'course_1', 'course_2', 'course_3', 'course_4', 'course_5',
]

/**
 * 同期 key：解析課程值「階-梯次」，回 `${level}-${batch}`。
 * 無梯次（「待確認梯次」「正取」「五運」等 parse 後 batch 為 null）回 null。
 */
export function cohortKey(courseValue: string | null | undefined): string | null {
  const parsed = parseCourseValue(courseValue)
  if (!parsed || parsed.level == null || parsed.batch == null) return null
  return `${parsed.level}-${parsed.batch}`
}

/** 一筆關聯邊的型別 */
export type RelationType = 'cohort' | 'spirit'

export interface RelatedStudent {
  student: OrgStudent
  /** 同期關聯的標籤（可能多階，如「一階 83 梯」「三階 12 梯」） */
  cohortLabels: string[]
  /** 同組關聯的標籤（心之使者組名），無則 null */
  spiritLabel: string | null
}

export interface RelationsResult {
  center: OrgStudent
  related: RelatedStudent[]
  /** 中心是否有任何可判定的同期 key（供 UI 提示） */
  centerHasCohort: boolean
  /** 中心是否有心之使者組別 */
  centerHasSpirit: boolean
}

/**
 * 以中心學員為核心，計算其橫向關聯：
 * - 同期同學：與中心在任一階同 cohortKey 的學員（記錄所有命中的階/梯 label）
 * - 同組組員：spirit_ambassador_group 與中心相同（且非空）
 * 一個人可能同時屬兩種關係，聚合為一筆 RelatedStudent。
 */
export function buildRelations(students: OrgStudent[], centerId: number): RelationsResult | null {
  const center = students.find((s) => s.id === centerId)
  if (!center) return null

  // 中心每一階的 cohortKey → 階 label
  const centerCohorts = new Map<string, string>() // key -> "一階 83 梯"
  for (const f of COURSE_FIELDS) {
    const key = cohortKey(center[f] as string | null)
    if (key) {
      const [lvl, batch] = key.split('-')
      centerCohorts.set(key, `${STAGE_LABEL[Number(lvl)] ?? `${lvl}階`} ${batch} 梯`)
    }
  }

  const centerSpirit = (center.spirit_ambassador_group ?? '').trim() || null

  const map = new Map<number, RelatedStudent>()

  for (const s of students) {
    if (s.id === centerId) continue

    // 同期：此人任一階的 cohortKey 命中中心的 cohort
    const cohortLabels: string[] = []
    for (const f of COURSE_FIELDS) {
      const key = cohortKey(s[f] as string | null)
      if (key && centerCohorts.has(key)) {
        cohortLabels.push(centerCohorts.get(key)!)
      }
    }

    // 同組
    const sSpirit = (s.spirit_ambassador_group ?? '').trim() || null
    const spiritLabel = centerSpirit && sSpirit === centerSpirit ? centerSpirit : null

    if (cohortLabels.length === 0 && !spiritLabel) continue

    map.set(s.id, {
      student: s,
      cohortLabels: [...new Set(cohortLabels)],
      spiritLabel,
    })
  }

  return {
    center,
    related: Array.from(map.values()),
    centerHasCohort: centerCohorts.size > 0,
    centerHasSpirit: !!centerSpirit,
  }
}

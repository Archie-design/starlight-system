import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Student, SheetSystem } from '@/lib/supabase/types'
import { applySystemFilter } from '@/lib/utils/system'
import {
  highestStage,
  membershipStatus,
  isNewbie,
  isResubscribeCandidate,
  owesPayment,
} from '@/lib/utils/studentStatus'
import { buildDuplicateNameSet, isDuplicateName, sortByNameGroup } from '@/lib/utils/duplicateName'
import type {
  StudentRepository,
  StudentFilters,
  MaintenanceCategory,
  PageRange,
  PagedStudents,
  CellEdit,
  RepositoryContextValue,
} from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any

/** 套用 FilterBar 的通用篩選條件（可下推到 SQL 的單欄位條件） */
function applyCommonFilters(query: Query, filters: StudentFilters, withCourse5: boolean): Query {
  if (filters.name)      query = query.ilike('name', `%${filters.name}%`)
  if (filters.counselor) query = query.ilike('counselor', `%${filters.counselor}%`)
  if (filters.region)    query = query.eq('region', filters.region)
  if (filters.role)      query = query.eq('role', filters.role)
  if (withCourse5 && filters.hasCourse5) query = query.not('course_5', 'is', null)
  if (filters.isSpirit)  query = query.not('spirit_ambassador_join_date', 'is', null)
  return query
}

/**
 * 需要全量載入 + JS 過濾的條件（無法用單一 PostgREST query 表達）：
 * 課程進度（最高階）、會籍狀態、新生時段、以及快捷視圖（續報/欠款/會籍/新生）。
 */
function needsPostFilter(filters: StudentFilters): boolean {
  return (
    (filters.courseStage !== '' && filters.courseStage !== undefined) ||
    (!!filters.membershipStatus) ||
    !!filters.isNewbie ||
    !!filters.view
  )
}

/**
 * JS 端套用課程進度 / 會籍 / 新生 / 快捷視圖條件
 * @param duplicates 'duplicate_name' 視圖用的重複姓名集合（由呼叫端先統計全量資料建立）
 */
function matchesPostFilter(
  s: Student,
  filters: StudentFilters,
  now: number,
  duplicates?: Set<string>,
): boolean {
  if (filters.courseStage !== '' && filters.courseStage !== undefined) {
    if (highestStage(s) !== filters.courseStage) return false
  }
  if (filters.membershipStatus) {
    if (membershipStatus(s.membership_expiry, now) !== filters.membershipStatus) return false
  }
  if (filters.isNewbie && !isNewbie(s, now)) return false

  switch (filters.view) {
    case 'resubscribe': if (!isResubscribeCandidate(s)) return false; break
    case 'owing':       if (!owesPayment(s)) return false; break
    case 'expiring': {
      const m = membershipStatus(s.membership_expiry, now)
      if (m !== 'expired' && m !== 'in30') return false
      break
    }
    case 'newbie':      if (!isNewbie(s, now)) return false; break
    // 同名：依全量統計出的重複姓名集合判定（集合未建立時視為無結果）
    case 'duplicate_name': if (!duplicates || !isDuplicateName(s, duplicates)) return false; break
  }
  return true
}

function rangeFor(range: PageRange): [number, number] {
  return [range.page * range.pageSize, (range.page + 1) * range.pageSize - 1]
}

class SupabaseStudentRepository implements StudentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /** 不含分頁的基礎查詢 */
  private baseSelect(): Query {
    return this.supabase
      .from('students')
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
  }

  /**
   * 依篩選決定執行路徑：
   * - 無跨欄位/全量條件 → SQL 下推 + range 分頁（高效）
   * - 有 courseStage/會籍/新生/view → 全量載入 + JS 過濾 + slice 分頁（資料量小可接受）
   */
  private async runPaged(query: Query, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    if (!needsPostFilter(filters)) {
      const [from, to] = rangeFor(range)
      const { data, error, count } = await query.range(from, to)
      if (error) throw error
      return { rows: data as Student[], count: count ?? 0 }
    }

    // 全量載入（分頁拉滿，避開 Supabase 1000 筆上限）
    const all: Student[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await query.range(from, from + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      all.push(...(data as Student[]))
      if (data.length < 1000) break
    }
    const now = Date.now()
    // 同名視圖需先以全量資料統計重複姓名（跨列判定，無法逐列得知）
    const duplicates =
      filters.view === 'duplicate_name' ? buildDuplicateNameSet(all) : undefined

    let filtered = all.filter((s) => matchesPostFilter(s, filters, now, duplicates))
    // 同名者相鄰顯示，便於逐一比對
    if (filters.view === 'duplicate_name') filtered = sortByNameGroup(filtered)

    const start = range.page * range.pageSize
    return { rows: filtered.slice(start, start + range.pageSize), count: filtered.length }
  }

  async findBySystem(system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    let query = applySystemFilter(this.baseSelect(), system)
    query = applyCommonFilters(query, filters, true)
    return this.runPaged(query, filters, range)
  }

  async findByGroupLeader(groupLeader: string, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    let query = applySystemFilter(this.baseSelect().eq('group_leader', groupLeader), system)
    query = applyCommonFilters(query, filters, true)
    return this.runPaged(query, filters, range)
  }

  async findByMaintenanceCategory(category: MaintenanceCategory, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    let query = this.baseSelect()
    switch (category) {
      case 'MISSING_GROUP':     query = query.is('group_leader', null); break
      case 'MISSING_COUNSELOR': query = query.is('senior_counselor', null); break
      case 'MISSING_CHAIN':     query = query.is('guidance_chain', null); break
    }
    query = applySystemFilter(query, system)
    // 維護專區不提供 hasCourse5 篩選
    query = applyCommonFilters(query, filters, false)
    return this.runPaged(query, filters, range)
  }

  async updateCell(edit: CellEdit): Promise<void> {
    const { error } = await this.supabase
      .from('students')
      .update({ [edit.field]: edit.value } as Record<string, unknown>)
      .eq('id', edit.id)
    if (error) throw error

    // 稽核 log（fire-and-forget，不阻塞 UI）
    // changed_by 來自登入者帳號（自訂 session，非 Supabase Auth）
    this.supabase.from('edit_logs').insert({
      student_id: edit.id,
      student_name: edit.studentName,
      field: edit.field,
      old_value: edit.oldValue,
      new_value: edit.value,
      changed_by: edit.changedBy ?? null,
    }).then(() => {})
  }
}

/** 建立以 Supabase 為後端的 Repository 上下文 */
export function createSupabaseRepositoryContext(): RepositoryContextValue {
  const supabase = createClient()
  return {
    students: new SupabaseStudentRepository(supabase),
  }
}

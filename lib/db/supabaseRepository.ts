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
import { sanitizeColumnFilters, matchesColumnFilters, SORTABLE_FIELDS, COLUMN_FILTER_FIELDS } from '@/lib/utils/columnFilter'
import type {
  StudentRepository,
  StudentFilters,
  MaintenanceCategory,
  PageRange,
  PagedStudents,
  CellEdit,
  RepositoryContextValue,
  SortState,
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

  // 表頭逐欄篩選：僅 text 型的「包含」條件（operator: 'contains'）可下推 ilike；
  // 其餘 operator（not_contains/equals/starts_with/ends_with/is_empty/is_not_empty）
  // 與 enum/range 型一律留給 JS 後處理（needsPostFilter）
  const columnFilters = sanitizeColumnFilters(filters.columnFilters)
  for (const [field, value] of Object.entries(columnFilters)) {
    if (value.type === 'text' && value.operator === 'contains' && value.value) {
      query = query.ilike(field, `%${value.value}%`)
    }
  }
  return query
}

/** 表頭逐欄篩選中，無法下推 SQL、須留給 JS 後處理的部分（enum/range，以及非「包含」的 text operator） */
function hasNonPushableColumnFilters(filters: StudentFilters): boolean {
  const columnFilters = sanitizeColumnFilters(filters.columnFilters)
  return Object.values(columnFilters).some((v) => v.type !== 'text' || v.operator !== 'contains')
}

/**
 * 需要全量載入 + JS 過濾的條件（無法用單一 PostgREST query 表達）：
 * 課程進度（最高階）、會籍狀態、新生時段、快捷視圖（續報/欠款/會籍/新生）、
 * 以及 enum/range 型的表頭逐欄篩選。
 */
function needsPostFilter(filters: StudentFilters): boolean {
  return (
    (filters.courseStage !== '' && filters.courseStage !== undefined) ||
    (!!filters.membershipStatus && filters.membershipStatus.length > 0) ||
    !!filters.isNewbie ||
    !!filters.view ||
    hasNonPushableColumnFilters(filters)
  )
}

/**
 * JS 端套用課程進度 / 會籍 / 新生 / 快捷視圖 / 表頭逐欄篩選條件
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
  if (filters.membershipStatus && filters.membershipStatus.length > 0) {
    if (!filters.membershipStatus.includes(membershipStatus(s.membership_expiry, now))) return false
  }
  if (filters.isNewbie && !isNewbie(s, now)) return false
  if (!matchesColumnFilters(s, sanitizeColumnFilters(filters.columnFilters))) return false

  switch (filters.view) {
    case 'resubscribe': if (!isResubscribeCandidate(s)) return false; break
    case 'owing':       if (!owesPayment(s)) return false; break
    case 'newbie':      if (!isNewbie(s, now)) return false; break
    // 同名：依全量統計出的重複姓名集合判定（集合未建立時視為無結果）
    case 'duplicate_name': if (!duplicates || !isDuplicateName(s, duplicates)) return false; break
  }
  return true
}

/** 依 sort 對全量結果排序（JS 後處理路徑用；SQL 下推路徑改用 .order()） */
function applySort(rows: Student[], sort?: SortState | null): Student[] {
  if (!sort || !SORTABLE_FIELDS.has(sort.field)) return rows
  const { field, direction } = sort
  const sorted = [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[field]
    const bv = (b as unknown as Record<string, unknown>)[field]
    if (av == null && bv == null) return 0
    if (av == null) return 1  // null 值排最後
    if (bv == null) return -1
    if (av < bv) return -1
    if (av > bv) return 1
    return 0
  })
  if (direction === 'desc') sorted.reverse()
  return sorted
}

function rangeFor(range: PageRange): [number, number] {
  return [range.page * range.pageSize, (range.page + 1) * range.pageSize - 1]
}

/**
 * 匯出（`app/api/export/route.ts`）需要用 service-role client（繞過 RLS）
 * 建構同一套 repository，因此匯出。一般前端流程請透過
 * `createSupabaseRepositoryContext()`（browser client + RLS）。
 */
export class SupabaseStudentRepository implements StudentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /** 不含分頁、不含排序的基礎查詢 */
  private baseSelect(): Query {
    return this.supabase
      .from('students')
      .select('*', { count: 'exact' })
  }

  /** 套用排序：白名單內欄位下推 `.order()`，否則沿用預設的 id 遞增 */
  private applyOrder(query: Query, sort?: SortState | null): Query {
    if (sort && SORTABLE_FIELDS.has(sort.field)) {
      return query.order(sort.field, { ascending: sort.direction === 'asc' })
    }
    return query.order('id', { ascending: true })
  }

  /**
   * 依篩選決定執行路徑：
   * - 無跨欄位/全量條件 → SQL 下推 + range 分頁（高效，排序已由 .order() 下推）
   * - 有 courseStage/會籍/新生/view/enum·range 表頭篩選 → 全量載入 + JS 過濾/排序 + slice 分頁
   */
  private async runPaged(query: Query, filters: StudentFilters, range: PageRange, sort?: SortState | null): Promise<PagedStudents> {
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
    // 同名者相鄰顯示，便於逐一比對；否則依 sort 排序（預設已是 id 遞增，因查詢已下推 .order()）
    if (filters.view === 'duplicate_name') filtered = sortByNameGroup(filtered)
    else if (sort) filtered = applySort(filtered, sort)

    const start = range.page * range.pageSize
    return { rows: filtered.slice(start, start + range.pageSize), count: filtered.length }
  }

  async findBySystem(system: SheetSystem, filters: StudentFilters, range: PageRange, sort?: SortState | null): Promise<PagedStudents> {
    let query = applySystemFilter(this.baseSelect(), system)
    query = applyCommonFilters(query, filters, true)
    query = this.applyOrder(query, sort)
    return this.runPaged(query, filters, range, sort)
  }

  async findByGroupLeader(groupLeader: string, system: SheetSystem, filters: StudentFilters, range: PageRange, sort?: SortState | null): Promise<PagedStudents> {
    let query = applySystemFilter(this.baseSelect().eq('group_leader', groupLeader), system)
    query = applyCommonFilters(query, filters, true)
    query = this.applyOrder(query, sort)
    return this.runPaged(query, filters, range, sort)
  }

  async findByMaintenanceCategory(category: MaintenanceCategory, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    let query = this.baseSelect().order('id', { ascending: true })
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

  /**
   * 取得指定欄位的不重複值清單（表頭「依值篩選」用）。查詢範圍套用體系隔離、
   * 選用的 group_leader（關懷長分組表格），以及其他已生效的表頭篩選——但明確
   * 排除 `field` 自身的篩選條件，否則已勾選的值會讓其他選項在下次開面板時消失
   * （見 design.md 決策 3）。
   */
  async getDistinctValues(
    field: string,
    system: SheetSystem,
    filters: StudentFilters,
    scope?: { groupLeader?: string }
  ): Promise<string[]> {
    if (!(field in COLUMN_FILTER_FIELDS)) return []

    const { [field]: _omit, ...restColumnFilters } = filters.columnFilters ?? {}
    const scopedFilters: StudentFilters = { ...filters, columnFilters: restColumnFilters }

    let query: Query = this.supabase.from('students').select(field)
    query = applySystemFilter(query, system)
    if (scope?.groupLeader) query = query.eq('group_leader', scope.groupLeader)
    query = applyCommonFilters(query, scopedFilters, true)

    const values = new Set<string>()
    const now = Date.now()
    // 需要 JS 後處理的條件（enum/range/課程進度/會籍/快捷視圖等）無法在
    // .select(field) 的窄查詢上直接套用，因此改為全量載入完整欄位後在
    // JS 端同時做後處理過濾與去重。
    if (needsPostFilter(scopedFilters)) {
      let fullQuery = applySystemFilter(this.baseSelect(), system)
      if (scope?.groupLeader) fullQuery = fullQuery.eq('group_leader', scope.groupLeader)
      fullQuery = applyCommonFilters(fullQuery, scopedFilters, true)
      const all: Student[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await fullQuery.range(from, from + 999)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...(data as Student[]))
        if (data.length < 1000) break
      }
      for (const s of all) {
        if (!matchesPostFilter(s, scopedFilters, now)) continue
        const raw = (s as unknown as Record<string, unknown>)[field]
        if (typeof raw === 'string' && raw !== '') values.add(raw)
      }
      return Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-Hant'))
    }

    for (let from = 0; ; from += 1000) {
      const { data, error } = await query.range(from, from + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      for (const row of data as Record<string, unknown>[]) {
        const raw = row[field]
        if (typeof raw === 'string' && raw !== '') values.add(raw)
      }
      if (data.length < 1000) break
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-Hant'))
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

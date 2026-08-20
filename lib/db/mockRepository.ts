import type { Student, SheetSystem } from '@/lib/supabase/types'
import { systemOf } from '@/lib/utils/system'
import {
  highestStage,
  membershipStatus,
  isSpirit,
  isNewbie,
  isResubscribeCandidate,
  owesPayment,
} from '@/lib/utils/studentStatus'
import { buildDuplicateNameSet, isDuplicateName, sortByNameGroup } from '@/lib/utils/duplicateName'
import { sanitizeColumnFilters, matchesColumnFilters } from '@/lib/utils/columnFilter'
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

/** 排序白名單：須與 `supabaseRepository.ts` 的 SORTABLE_FIELDS 一致 */
const SORTABLE_FIELDS = new Set([
  'id', 'name', 'birthday', 'membership_expiry',
  'spirit_ambassador_join_date', 'love_giving_start_date',
])

function matchesFilters(s: Student, filters: StudentFilters, duplicates?: Set<string>): boolean {
  const now = Date.now()
  if (filters.name && !s.name.includes(filters.name)) return false
  if (filters.counselor && !(s.counselor ?? '').includes(filters.counselor)) return false
  if (filters.region && s.region !== filters.region) return false
  if (filters.role && s.role !== filters.role) return false
  if (filters.hasCourse5 && !s.course_5) return false
  if (filters.isSpirit && !isSpirit(s)) return false
  if (filters.courseStage !== '' && filters.courseStage !== undefined && highestStage(s) !== filters.courseStage) return false
  if (filters.membershipStatus && filters.membershipStatus.length > 0 && !filters.membershipStatus.includes(membershipStatus(s.membership_expiry, now))) return false
  if (filters.isNewbie && !isNewbie(s, now)) return false
  if (!matchesColumnFilters(s, sanitizeColumnFilters(filters.columnFilters))) return false
  switch (filters.view) {
    case 'resubscribe': if (!isResubscribeCandidate(s)) return false; break
    case 'owing':       if (!owesPayment(s)) return false; break
    case 'newbie':      if (!isNewbie(s, now)) return false; break
    // 同名：依呼叫端先統計的重複姓名集合判定
    case 'duplicate_name': if (!duplicates || !isDuplicateName(s, duplicates)) return false; break
  }
  return true
}

/** 依 sort 對結果排序；field 不在白名單內時原樣返回 */
function applySort(rows: Student[], sort?: SortState | null): Student[] {
  if (!sort || !SORTABLE_FIELDS.has(sort.field)) return rows
  const { field, direction } = sort
  const sorted = [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[field]
    const bv = (b as unknown as Record<string, unknown>)[field]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (av < bv) return -1
    if (av > bv) return 1
    return 0
  })
  if (direction === 'desc') sorted.reverse()
  return sorted
}

function paginate(rows: Student[], range: PageRange): PagedStudents {
  const start = range.page * range.pageSize
  return {
    rows: rows.slice(start, start + range.pageSize),
    count: rows.length,
  }
}

/**
 * 純記憶體的 Repository 實作，供單元測試使用。
 * 不依賴 Supabase，可直接注入 RepositoryProvider 的 `value`。
 *
 * @example
 * const repo = new MockStudentRepository([{ id: 1, name: '王小明', ... }])
 * render(<RepositoryProvider value={{ students: repo }}>...</RepositoryProvider>)
 */
export class MockStudentRepository implements StudentRepository {
  constructor(public data: Student[] = []) {}

  /** 同名統計母體＝該體系全體（與正式查詢層一致，不跨體系） */
  private duplicatesFor(system: SheetSystem, filters: StudentFilters): Set<string> | undefined {
    if (filters.view !== 'duplicate_name') return undefined
    return buildDuplicateNameSet(this.data.filter((s) => systemOf(s.business_chain) === system))
  }

  async findBySystem(system: SheetSystem, filters: StudentFilters, range: PageRange, sort?: SortState | null): Promise<PagedStudents> {
    const duplicates = this.duplicatesFor(system, filters)
    const filtered = this.data
      .filter((s) => systemOf(s.business_chain) === system && matchesFilters(s, filters, duplicates))
    const rows = filters.view === 'duplicate_name'
      ? sortByNameGroup(filtered)
      : applySort(filtered.sort((a, b) => a.id - b.id), sort)
    return paginate(rows, range)
  }

  async findByGroupLeader(groupLeader: string, system: SheetSystem, filters: StudentFilters, range: PageRange, sort?: SortState | null): Promise<PagedStudents> {
    const duplicates = this.duplicatesFor(system, filters)
    const filtered = this.data
      .filter((s) => s.group_leader === groupLeader && systemOf(s.business_chain) === system && matchesFilters(s, filters, duplicates))
    const rows = filters.view === 'duplicate_name'
      ? sortByNameGroup(filtered)
      : applySort(filtered.sort((a, b) => a.id - b.id), sort)
    return paginate(rows, range)
  }

  async findByMaintenanceCategory(category: MaintenanceCategory, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    const duplicates = this.duplicatesFor(system, filters)
    const rows = this.data
      .filter((s) => {
        if (systemOf(s.business_chain) !== system) return false
        if (category === 'MISSING_GROUP' && s.group_leader != null) return false
        if (category === 'MISSING_COUNSELOR' && s.senior_counselor != null) return false
        if (category === 'MISSING_CHAIN' && s.guidance_chain != null) return false
        return matchesFilters(s, filters, duplicates)
      })
      .sort((a, b) => a.id - b.id)
    return paginate(rows, range)
  }

  async updateCell(edit: CellEdit): Promise<void> {
    const student = this.data.find((s) => s.id === edit.id)
    if (student) {
      ;(student as unknown as Record<string, unknown>)[edit.field] = edit.value
    }
  }
}

/** 建立純 mock 的 Repository 上下文 */
export function createMockRepositoryContext(students: Student[] = []): RepositoryContextValue {
  return {
    students: new MockStudentRepository(students),
  }
}

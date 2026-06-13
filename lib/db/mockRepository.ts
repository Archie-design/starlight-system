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
import type {
  StudentRepository,
  StudentFilters,
  MaintenanceCategory,
  PageRange,
  PagedStudents,
  CellEdit,
  RepositoryContextValue,
} from './types'

function matchesFilters(s: Student, filters: StudentFilters): boolean {
  const now = Date.now()
  if (filters.name && !s.name.includes(filters.name)) return false
  if (filters.counselor && !(s.counselor ?? '').includes(filters.counselor)) return false
  if (filters.region && s.region !== filters.region) return false
  if (filters.role && s.role !== filters.role) return false
  if (filters.hasCourse5 && !s.course_5) return false
  if (filters.isSpirit && !isSpirit(s)) return false
  if (filters.courseStage !== '' && filters.courseStage !== undefined && highestStage(s) !== filters.courseStage) return false
  if (filters.membershipStatus && membershipStatus(s.membership_expiry, now) !== filters.membershipStatus) return false
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
  }
  return true
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

  async findBySystem(system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    const rows = this.data
      .filter((s) => systemOf(s.business_chain) === system && matchesFilters(s, filters))
      .sort((a, b) => a.id - b.id)
    return paginate(rows, range)
  }

  async findByGroupLeader(groupLeader: string, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    const rows = this.data
      .filter((s) => s.group_leader === groupLeader && systemOf(s.business_chain) === system && matchesFilters(s, filters))
      .sort((a, b) => a.id - b.id)
    return paginate(rows, range)
  }

  async findByMaintenanceCategory(category: MaintenanceCategory, system: SheetSystem, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    const rows = this.data
      .filter((s) => {
        if (systemOf(s.business_chain) !== system) return false
        if (category === 'MISSING_GROUP' && s.group_leader != null) return false
        if (category === 'MISSING_COUNSELOR' && s.senior_counselor != null) return false
        if (category === 'MISSING_CHAIN' && s.guidance_chain != null) return false
        return matchesFilters(s, filters)
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

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Student } from '@/lib/supabase/types'
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

/** 套用 FilterBar 的通用篩選條件 */
function applyCommonFilters(query: Query, filters: StudentFilters, withCourse5: boolean): Query {
  if (filters.name)      query = query.ilike('name', `%${filters.name}%`)
  if (filters.counselor) query = query.ilike('counselor', `%${filters.counselor}%`)
  if (filters.region)    query = query.eq('region', filters.region)
  if (filters.role)      query = query.eq('role', filters.role)
  if (withCourse5 && filters.hasCourse5) query = query.not('course_5', 'is', null)
  return query
}

function rangeFor(range: PageRange): [number, number] {
  return [range.page * range.pageSize, (range.page + 1) * range.pageSize - 1]
}

class SupabaseStudentRepository implements StudentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private baseQuery(range: PageRange): Query {
    const [from, to] = rangeFor(range)
    return this.supabase
      .from('students')
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to)
  }

  private async run(query: Query): Promise<PagedStudents> {
    const { data, error, count } = await query
    if (error) throw error
    return { rows: data as Student[], count: count ?? 0 }
  }

  async findBySheet(sheet: string, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    let query = this.baseQuery(range).eq('sheet_system', sheet)
    query = applyCommonFilters(query, filters, true)
    return this.run(query)
  }

  async findByGroupLeader(groupLeader: string, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    let query = this.baseQuery(range).eq('group_leader', groupLeader)
    query = applyCommonFilters(query, filters, true)
    return this.run(query)
  }

  async findByMaintenanceCategory(category: MaintenanceCategory, filters: StudentFilters, range: PageRange): Promise<PagedStudents> {
    let query = this.baseQuery(range)
    switch (category) {
      case 'MISSING_GROUP':     query = query.is('group_leader', null); break
      case 'MISSING_COUNSELOR': query = query.is('senior_counselor', null); break
      case 'MISSING_CHAIN':     query = query.is('guidance_chain', null); break
    }
    // 維護專區不提供 hasCourse5 篩選
    query = applyCommonFilters(query, filters, false)
    return this.run(query)
  }

  async updateCell(edit: CellEdit): Promise<void> {
    const { error } = await this.supabase
      .from('students')
      .update({ [edit.field]: edit.value } as Record<string, unknown>)
      .eq('id', edit.id)
    if (error) throw error

    // 稽核 log（fire-and-forget，不阻塞 UI）
    this.supabase.auth.getUser().then(({ data: { user } }) => {
      this.supabase.from('edit_logs').insert({
        student_id: edit.id,
        student_name: edit.studentName,
        field: edit.field,
        old_value: edit.oldValue,
        new_value: edit.value,
        changed_by: user?.email ?? null,
      }).then(() => {})
    })
  }
}

/** 建立以 Supabase 為後端的 Repository 上下文 */
export function createSupabaseRepositoryContext(): RepositoryContextValue {
  const supabase = createClient()
  return {
    students: new SupabaseStudentRepository(supabase),
  }
}

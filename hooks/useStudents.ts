'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useStudentStore } from '@/store/useStudentStore'
import type { Student } from '@/lib/supabase/types'

export const PAGE_SIZE = 100

export function useStudents() {
  const { activeTab, filters, page } = useStudentStore()
  const supabase = createClient()

  const key = ['students', activeTab, filters, page]

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    async () => {
      let query = supabase
        .from('students')
        .select('*', { count: 'exact' })
        .eq('sheet_system', activeTab)
        .order('id', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`)
      }
      if (filters.counselor) {
        query = query.ilike('counselor', `%${filters.counselor}%`)
      }
      if (filters.region) {
        query = query.eq('region', filters.region)
      }
      if (filters.role) {
        query = query.eq('role', filters.role)
      }
      if (filters.hasCourse5) {
        query = query.not('course_5', 'is', null)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data as Student[], count: count ?? 0 }
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  )

  /**
   * 單一欄位 optimistic update
   */
  async function updateCell(id: number, field: keyof Student, value: string | null) {
    const supabase = createClient()
    const student = data?.rows.find((r) => r.id === id)
    const oldValue = (student?.[field] as string | null) ?? null
    const studentName = student?.name ?? null

    // Optimistic update
    await mutate(
      async (current) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase
          .from('students')
          .update({ [field]: value } as Record<string, unknown>)
          .eq('id', id)
        if (error) throw error

        // 稽核 log（fire-and-forget，不阻塞 UI）
        supabase.auth.getUser().then(({ data: { user } }) => {
          supabase.from('edit_logs').insert({
            student_id: id,
            student_name: studentName,
            field: field as string,
            old_value: oldValue,
            new_value: value,
            changed_by: user?.email ?? null,
          }).then(() => {})
        })

        return current
          ? {
              ...current,
              rows: current.rows.map((r) =>
                r.id === id ? { ...r, [field]: value } : r
              ),
            }
          : current
      },
      {
        optimisticData: data
          ? {
              ...data,
              rows: data.rows.map((r) =>
                r.id === id ? { ...r, [field]: value } : r
              ),
            }
          : data,
        rollbackOnError: true,
      }
    )
  }

  return {
    students: data?.rows ?? [],
    count: data?.count ?? 0,
    isLoading,
    error,
    mutate,
    updateCell,
  }
}

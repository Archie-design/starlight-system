'use client'

import useSWR from 'swr'
import { useRepository } from '@/lib/context/RepositoryContext'
import { useStudentStore } from '@/store/useStudentStore'
import type { Student } from '@/lib/supabase/types'

export const PAGE_SIZE = 100

export function useStudents() {
  const { activeTab, filters, page } = useStudentStore()
  const { students: repo } = useRepository()

  const key = ['students', activeTab, filters, page]

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    () => repo.findBySystem(activeTab, filters, { page, pageSize: PAGE_SIZE }),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  )

  /**
   * 單一欄位 optimistic update
   */
  async function updateCell(id: number, field: keyof Student, value: string | null) {
    const student = data?.rows.find((r) => r.id === id)
    const oldValue = (student?.[field] as string | null) ?? null
    const studentName = student?.name ?? null

    // Optimistic update
    await mutate(
      async (current) => {
        await repo.updateCell({ id, field: field as string, value, oldValue, studentName })

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

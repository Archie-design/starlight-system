'use client'

import useSWR from 'swr'
import { useRepository } from '@/lib/context/RepositoryContext'
import { useCounselorStore } from '@/store/useCounselorStore'
import type { Student } from '@/lib/supabase/types'

export const COUNSELOR_PAGE_SIZE = 100

export function useCounselorStudents() {
  const { system, activeGroup, filters, page, username } = useCounselorStore()
  const { students: repo } = useRepository()

  const key = activeGroup
    ? ['counselor-students', system, activeGroup, filters, page]
    : null  // null → SWR 不發請求

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    () => repo.findByGroupLeader(activeGroup!, system, filters, { page, pageSize: COUNSELOR_PAGE_SIZE }),
    { keepPreviousData: true, revalidateOnFocus: false }
  )

  async function updateCell(id: number, field: keyof Student, value: string | null) {
    const student = data?.rows.find((r) => r.id === id)
    const oldValue = (student?.[field] as string | null) ?? null
    const studentName = student?.name ?? null

    await mutate(
      async (current) => {
        await repo.updateCell({ id, field: field as string, value, oldValue, studentName, changedBy: username || null })

        return current
          ? { ...current, rows: current.rows.map(r => r.id === id ? { ...r, [field]: value } : r) }
          : current
      },
      {
        optimisticData: data
          ? { ...data, rows: data.rows.map(r => r.id === id ? { ...r, [field]: value } : r) }
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

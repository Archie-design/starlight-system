'use client'

import useSWR from 'swr'
import { useRepository } from '@/lib/context/RepositoryContext'
import { useStudentStore } from '@/store/useStudentStore'
import { useUpdateCell } from './useUpdateCell'
import type { Student } from '@/lib/supabase/types'

export const PAGE_SIZE = 100

export function useStudents() {
  const { activeTab, filters, page, username, sort } = useStudentStore()
  const { students: repo } = useRepository()

  const key = ['students', activeTab, filters, page, sort]

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    () => repo.findBySystem(activeTab, filters, { page, pageSize: PAGE_SIZE }, sort),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  )

  const updateCell = useUpdateCell(repo, data, mutate, username)

  return {
    students: data?.rows ?? [],
    count: data?.count ?? 0,
    isLoading,
    error,
    mutate,
    updateCell,
  }
}

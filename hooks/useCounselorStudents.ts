'use client'

import useSWR from 'swr'
import { useRepository } from '@/lib/context/RepositoryContext'
import { useCounselorStore } from '@/store/useCounselorStore'
import { useUpdateCell } from './useUpdateCell'
import type { Student } from '@/lib/supabase/types'

export const COUNSELOR_PAGE_SIZE = 100

export function useCounselorStudents() {
  const { system, activeGroup, filters, page, username, sort } = useCounselorStore()
  const { students: repo } = useRepository()

  const key = activeGroup
    ? ['counselor-students', system, activeGroup, filters, page, sort]
    : null  // null → SWR 不發請求

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    () => repo.findByGroupLeader(activeGroup!, system, filters, { page, pageSize: COUNSELOR_PAGE_SIZE }, sort),
    { keepPreviousData: true, revalidateOnFocus: false }
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

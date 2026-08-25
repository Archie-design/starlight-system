'use client'

import useSWR from 'swr'
import { useRepository } from '@/lib/context/RepositoryContext'
import { useMaintenanceStore } from '@/store/useMaintenanceStore'
import { useUpdateCell } from './useUpdateCell'
import type { Student } from '@/lib/supabase/types'

export const MAINTENANCE_PAGE_SIZE = 100

export function useMaintenanceStudents() {
  const { system, activeCategory, filters, page, username } = useMaintenanceStore()
  const { students: repo } = useRepository()

  const key = ['maintenance-students', system, activeCategory, filters, page]

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    () => repo.findByMaintenanceCategory(activeCategory, system, filters, { page, pageSize: MAINTENANCE_PAGE_SIZE }),
    { keepPreviousData: true, revalidateOnFocus: false }
  )

  // removeOnEdit：維護專區中若修正了關鍵欄位導致條件不符，資料應自動從列表
  // 中移除，因此寫入成功後不直接改本地資料，改由 revalidate 重新抓取。
  const updateCell = useUpdateCell(repo, data, mutate, username, { removeOnEdit: true })

  return {
    students: data?.rows ?? [],
    count: data?.count ?? 0,
    isLoading,
    error,
    mutate,
    updateCell,
  }
}

'use client'

import useSWR from 'swr'
import { useRepository } from '@/lib/context/RepositoryContext'
import { useMaintenanceStore } from '@/store/useMaintenanceStore'
import type { Student } from '@/lib/supabase/types'

export const MAINTENANCE_PAGE_SIZE = 100

export function useMaintenanceStudents() {
  const { system, activeCategory, filters, page } = useMaintenanceStore()
  const { students: repo } = useRepository()

  const key = ['maintenance-students', system, activeCategory, filters, page]

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    () => repo.findByMaintenanceCategory(activeCategory, system, filters, { page, pageSize: MAINTENANCE_PAGE_SIZE }),
    { keepPreviousData: true, revalidateOnFocus: false }
  )

  async function updateCell(id: number, field: keyof Student, value: string | null) {
    const student = data?.rows.find((r) => r.id === id)
    const oldValue = (student?.[field] as string | null) ?? null
    const studentName = student?.name ?? null

    await mutate(
      async (current) => {
        await repo.updateCell({ id, field: field as string, value, oldValue, studentName })

        // 在維護專區中，若修正了關鍵欄位導致條件不符，資料應自動從列表中移除
        // 這裡回傳 current，讓 mutate 的 revalidate 行為去處理重新抓取資料
        return current
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

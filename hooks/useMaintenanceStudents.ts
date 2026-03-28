'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useMaintenanceStore, MaintenanceCategory } from '@/store/useMaintenanceStore'
import type { Student } from '@/lib/supabase/types'

export const MAINTENANCE_PAGE_SIZE = 100

export function useMaintenanceStudents() {
  const { activeCategory, filters, page } = useMaintenanceStore()
  const supabase = createClient()

  const key = ['maintenance-students', activeCategory, filters, page]

  const { data, error, isLoading, mutate } = useSWR<{ rows: Student[]; count: number }>(
    key,
    async () => {
      let query = supabase
        .from('students')
        .select('*', { count: 'exact' })
        .order('id', { ascending: true })
        .range(page * MAINTENANCE_PAGE_SIZE, (page + 1) * MAINTENANCE_PAGE_SIZE - 1)

      // 1. 根據維護類別注入基礎複查邏輯
      switch (activeCategory) {
        case 'MISSING_GROUP':
          query = query.is('group_leader', null)
          break
        case 'MISSING_COUNSELOR':
          query = query.is('senior_counselor', null)
          break
        case 'MISSING_CHAIN':
          query = query.is('guidance_chain', null)
          break
      }

      // 2. 注入通用篩選器
      if (filters.name)      query = query.ilike('name', `%${filters.name}%`)
      if (filters.counselor) query = query.ilike('counselor', `%${filters.counselor}%`)
      if (filters.region)    query = query.eq('region', filters.region)
      if (filters.role)      query = query.eq('role', filters.role)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: data as Student[], count: count ?? 0 }
    },
    { keepPreviousData: true, revalidateOnFocus: false }
  )

  async function updateCell(id: number, field: keyof Student, value: string | null) {
    const student = data?.rows.find((r) => r.id === id)
    const oldValue = (student?.[field] as string | null) ?? null
    const studentName = student?.name ?? null

    await mutate(
      async (current) => {
        const { error } = await supabase
          .from('students')
          .update({ [field]: value } as Record<string, unknown>)
          .eq('id', id)
        if (error) throw error

        // 稽核 log (fire-and-forget)
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

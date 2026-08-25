'use client'

import type { KeyedMutator } from 'swr'
import type { Student } from '@/lib/supabase/types'
import type { StudentRepository, PagedStudents } from '@/lib/db/types'

/**
 * 共用的「單一欄位 optimistic update」邏輯，供 useStudents / useCounselorStudents /
 * useMaintenanceStudents 共用（原本三處逐字重複，只有 useMaintenanceStudents 因
 * 「編輯後條件不符需整列消失」的業務差異而讓 mutator 回傳 `current` 不變、改由
 * revalidate 重新抓取資料，其餘完全相同）。
 *
 * @param removeOnEdit 為 true 時，寫入成功後不在本地資料裡直接改值，而是保持
 *   `current` 不變、讓 SWR revalidate 重新抓取（維護專區用：編輯後若不再符合
 *   該類別條件，資料應自動從清單消失，不能靠本地樂觀更新模擬）。
 */
export function useUpdateCell(
  repo: StudentRepository,
  data: PagedStudents | undefined,
  mutate: KeyedMutator<PagedStudents>,
  username: string,
  options?: { removeOnEdit?: boolean }
) {
  const removeOnEdit = options?.removeOnEdit ?? false

  return async function updateCell(id: number, field: keyof Student, value: string | null) {
    const student = data?.rows.find((r) => r.id === id)
    const oldValue = (student?.[field] as string | null) ?? null
    const studentName = student?.name ?? null

    await mutate(
      async (current) => {
        await repo.updateCell({ id, field: field as string, value, oldValue, studentName, changedBy: username || null })

        if (removeOnEdit) return current

        return current
          ? { ...current, rows: current.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)) }
          : current
      },
      {
        optimisticData: data
          ? { ...data, rows: data.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)) }
          : data,
        rollbackOnError: true,
      }
    )
  }
}

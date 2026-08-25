'use client'

import { createContext, useContext } from 'react'
import type { Student } from '@/lib/supabase/types'

export type UpdateCellFn = (id: number, field: keyof Student, value: string | null) => Promise<void>

const StudentEditContext = createContext<UpdateCellFn | null>(null)

/**
 * 提供 `updateCell` 給表格內所有 `EditableCell` 使用，取代原本每個
 * `EditableCell` 各自呼叫 `useStudents()` 的做法。這修了兩個問題：
 *
 * 1. 效能：一頁 100 列 × ~35 可編輯欄 ≈ 3500 個 EditableCell 若各自訂閱
 *    同一個 SWR key，任一格編輯觸發 mutate() 就會讓全部 3500 個訂閱者
 *    重新渲染一次。改由父層（StudentGrid/CounselorStudentGrid/
 *    MaintenanceStudentGrid）取得單一 updateCell，透過 context 往下傳，
 *    子元件不再各自訂閱 SWR 資料源。
 * 2. 正確性：`EditableCell` 原本寫死呼叫 `useStudents()`（`/students`
 *    頁面專用的 hook），但它是 `columns.tsx` 共用的欄位定義，也被
 *    `CounselorStudentGrid`／`MaintenanceStudentGrid` 使用——這代表在
 *    這兩個頁面編輯儲存格時，樂觀更新寫入的其實是 `/students` 的 SWR
 *    快取（不會反映在畫面上），且稽核紀錄用來比對的 oldValue 是從
 *    `/students` 的資料裡找（範圍不同，很可能找不到、記成 null）。
 *    改用 context 後，每個頁面各自 Provider 自己的 updateCell，範圍
 *    正確對應到畫面實際顯示的資料。
 */
export function StudentEditProvider({
  updateCell,
  children,
}: {
  updateCell: UpdateCellFn
  children: React.ReactNode
}) {
  return <StudentEditContext.Provider value={updateCell}>{children}</StudentEditContext.Provider>
}

export function useStudentEditContext(): UpdateCellFn {
  const ctx = useContext(StudentEditContext)
  if (!ctx) {
    throw new Error('useStudentEditContext must be used within a StudentEditProvider')
  }
  return ctx
}

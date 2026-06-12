'use client'

import { createContext, useContext, useMemo } from 'react'
import type { RepositoryContextValue } from '@/lib/db/types'
import { createSupabaseRepositoryContext } from '@/lib/db/supabaseRepository'

const RepositoryContext = createContext<RepositoryContextValue | null>(null)

/**
 * 提供 Repository 上下文給整個 App。預設使用 Supabase 實作；
 * 測試時可透過 `value` 注入 mock repository。
 */
export function RepositoryProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value?: RepositoryContextValue
}) {
  // 預設僅建立一次（Supabase client 為單例）；若外部注入則直接採用
  const repositories = useMemo(() => value ?? createSupabaseRepositoryContext(), [value])

  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  )
}

export function useRepository(): RepositoryContextValue {
  const context = useContext(RepositoryContext)
  if (!context) {
    throw new Error('useRepository must be used within a RepositoryProvider')
  }
  return context
}

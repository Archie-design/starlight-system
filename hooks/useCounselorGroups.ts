'use client'

import useSWR from 'swr'
import type { CounselorGroup, SheetSystem } from '@/lib/supabase/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/**
 * 取得（依登入者有效體系過濾後的）關懷長分組。
 * 體系以 server session 為準；query 上的 system 僅作為 SWR cache key，
 * 讓 superadmin 切換體系時自動重新抓取。
 */
export function useCounselorGroups(system?: SheetSystem) {
  const key = system
    ? `/api/counselor-groups?system=${encodeURIComponent(system)}`
    : '/api/counselor-groups'
  const { data, isLoading, error, mutate } = useSWR<{ groups: CounselorGroup[] }>(
    key,
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    groups: data?.groups ?? [],
    isLoading,
    error,
    mutate,
  }
}

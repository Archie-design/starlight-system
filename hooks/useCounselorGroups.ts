'use client'

import useSWR from 'swr'
import { csrfFetch } from '@/lib/utils/csrf'
import type { CounselorGroup, SheetSystem } from '@/lib/supabase/types'

// 正式站/preview 部署下 checkAuth(request) 的 CSRF 檢查需要 x-csrf-token
// header（見 lib/utils/csrf.ts），普通 fetch 沒有帶會被判定失敗、回 401。
const fetcher = (url: string) => csrfFetch(url).then(r => r.json())

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

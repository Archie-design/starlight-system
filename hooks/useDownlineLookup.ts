'use client'

import useSWR from 'swr'
import { csrfFetch } from '@/lib/utils/csrf'

export interface DownlineStudent {
  id: number
  name: string
  introducer: string | null
  counselor: string | null
}

const fetcher = (url: string) => csrfFetch(url).then(r => r.json())

/**
 * 輕量版學員清單（僅 id/name/introducer/counselor），供「白名單換線」等
 * 只需要在扁平清單上做介紹人/關懷長 filter、不需要組織樹的場景使用。
 * 查詢 /api/org/downlines——刻意不重用 useOrgData()/`/api/org`：那支
 * 會回傳 20+ 欄位並觸發 buildTree() 對全體系學員遞迴建樹，這裡完全用
 * 不到樹狀結構，重用它只是白白拉大量資料、做大量無用的運算。
 */
export function useDownlineLookup() {
  const { data, isLoading, error } = useSWR<{ students: DownlineStudent[] }>(
    '/api/org/downlines',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  )

  return {
    students: data?.students ?? [],
    isLoading,
    error,
  }
}

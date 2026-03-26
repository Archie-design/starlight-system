'use client'

import useSWR from 'swr'
import type { CounselorGroup } from '@/lib/supabase/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useCounselorGroups() {
  const { data, isLoading, error, mutate } = useSWR<{ groups: CounselorGroup[] }>(
    '/api/counselor-groups',
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

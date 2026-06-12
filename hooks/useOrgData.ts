'use client'

import useSWR from 'swr'
import { useMemo } from 'react'
import { useStudentStore } from '@/store/useStudentStore'
import { buildTree, type TreeNode, type OrgStudent } from '@/lib/utils/buildTree'

const fetcher = (url: string) => fetch(url, {
  headers: {
    'Accept': 'application/json',
  }
}).then(r => r.json())

export function useOrgData(): {
  roots: TreeNode[]
  students: OrgStudent[]
  totalCount: number
  isLoading: boolean
  error: unknown
} {
  const { activeTab } = useStudentStore()

  // 並行加載三個 API（而不是串行）
  // 使用 SWR 的並行模式：同時發起三個請求
  const { data, isLoading: orgLoading, error: orgError } = useSWR<{ students: OrgStudent[] }>(
    `/api/org?system=${encodeURIComponent(activeTab)}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
      // 添加 HTTP 緩存頭支持（ETag/Last-Modified）
      compare: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }
  )

  const { data: aliasData, isLoading: aliasLoading } = useSWR<{ aliases: { original_parent_id: number; proxy_parent_id: number }[] }>(
    '/api/parent-aliases',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
    }
  )

  const { data: overrideData, isLoading: overrideLoading } = useSWR<{ overrides: { student_id: number; override_parent_id: number }[] }>(
    '/api/student-overrides',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
    }
  )

  // 並行加載完成時的整體加載狀態（任何一個還在加載就是 true）
  const isLoading = orgLoading || aliasLoading || overrideLoading

  // 並行加載完成時的整體錯誤狀態
  const error = orgError

  const aliases = useMemo(() => {
    const map: Record<number, number> = {}
    aliasData?.aliases.forEach(a => {
      map[a.original_parent_id] = a.proxy_parent_id
    })
    return map
  }, [aliasData])

  const overrides = useMemo(() => {
    const map: Record<number, number> = {}
    overrideData?.overrides.forEach(o => {
      map[o.student_id] = o.override_parent_id
    })
    return map
  }, [overrideData])

  const students = data?.students ?? []
  const roots = useMemo(() => (
    students.length > 0 ? buildTree(students, aliases, overrides) : []
  ), [students, aliases, overrides])

  return { roots, students, totalCount: students.length, isLoading, error }
}

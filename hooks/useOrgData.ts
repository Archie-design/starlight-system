'use client'

import useSWR from 'swr'
import { useMemo } from 'react'
import { useStudentStore } from '@/store/useStudentStore'
import { buildTree, type TreeNode, type OrgStudent } from '@/lib/utils/buildTree'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useOrgData(): {
  roots: TreeNode[]
  students: OrgStudent[]
  totalCount: number
  isLoading: boolean
  error: unknown
} {
  const { activeTab } = useStudentStore()
  const { data, isLoading, error } = useSWR<{ students: OrgStudent[] }>(
    `/api/org?system=${encodeURIComponent(activeTab)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  )

  const { data: aliasData } = useSWR<{ aliases: { original_parent_id: number; proxy_parent_id: number }[] }>(
    '/api/parent-aliases',
    fetcher
  )

  const { data: overrideData } = useSWR<{ overrides: { student_id: number; override_parent_id: number }[] }>(
    '/api/student-overrides',
    fetcher
  )

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

'use client'

import useSWR from 'swr'
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
    { revalidateOnFocus: false }
  )

  const students = data?.students ?? []
  const roots = students.length > 0 ? buildTree(students) : []

  return { roots, students, totalCount: students.length, isLoading, error }
}

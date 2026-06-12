'use client'

import { useMemo } from 'react'

interface GroupStudent {
  group_leader: string
}

interface MembershipData {
  id: string
  name: string
  membership_expiry: string
}

export interface DashboardStats {
  groupStats: { name: string; count: number }[]
  membershipAlerts: {
    expired: MembershipData[]
    within30: MembershipData[]
    within90: MembershipData[]
  }
}

export function useDashboardStats(
  groupStudents: GroupStudent[],
  membershipData: MembershipData[]
): DashboardStats {
  const groupStats = useMemo(() => {
    const counts: Record<string, number> = {}
    groupStudents.forEach((s) => {
      const name = s.group_leader.trim() || '未分組'
      counts[name] = (counts[name] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [groupStudents])

  const membershipAlerts = useMemo(() => {
    const now = new Date().getTime()
    const msPerDay = 1000 * 60 * 60 * 24

    const expired: MembershipData[] = []
    const within30: MembershipData[] = []
    const within90: MembershipData[] = []

    membershipData.forEach((s) => {
      if (!s.membership_expiry) return
      const expiry = new Date(s.membership_expiry).getTime()
      const diffDays = Math.ceil((expiry - now) / msPerDay)

      if (diffDays < 0) {
        expired.push(s)
      } else if (diffDays <= 30) {
        within30.push(s)
      } else if (diffDays <= 90) {
        within90.push(s)
      }
    })

    return { expired, within30, within90 }
  }, [membershipData])

  return { groupStats, membershipAlerts }
}

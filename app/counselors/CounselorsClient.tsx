'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import CounselorsLayout from '@/components/CounselorsLayout'
import { useCounselorStore } from '@/store/useCounselorStore'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export default function CounselorsClient({ role, system, username, displayName }: { role: UserRole; system: SheetSystem; username: string; displayName: string | null }) {
  const setSystem = useCounselorStore((s) => s.setSystem)
  const setRole = useCounselorStore((s) => s.setRole)
  const setUsername = useCounselorStore((s) => s.setUsername)
  const setDisplayName = useCounselorStore((s) => s.setDisplayName)

  useEffect(() => {
    setRole(role)
    setSystem(system)
    setUsername(username)
    setDisplayName(displayName)
  }, [role, system, username, displayName, setRole, setSystem, setUsername, setDisplayName])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <CounselorsLayout />
    </SWRConfig>
  )
}

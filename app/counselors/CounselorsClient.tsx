'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import CounselorsLayout from '@/components/CounselorsLayout'
import { useCounselorStore } from '@/store/useCounselorStore'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export default function CounselorsClient({ role, system, username }: { role: UserRole; system: SheetSystem; username: string }) {
  const setSystem = useCounselorStore((s) => s.setSystem)
  const setRole = useCounselorStore((s) => s.setRole)
  const setUsername = useCounselorStore((s) => s.setUsername)

  useEffect(() => {
    setRole(role)
    setSystem(system)
    setUsername(username)
  }, [role, system, username, setRole, setSystem, setUsername])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <CounselorsLayout />
    </SWRConfig>
  )
}

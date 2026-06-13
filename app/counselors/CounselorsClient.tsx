'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import CounselorsLayout from '@/components/CounselorsLayout'
import { useCounselorStore } from '@/store/useCounselorStore'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export default function CounselorsClient({ role, system }: { role: UserRole; system: SheetSystem }) {
  const setSystem = useCounselorStore((s) => s.setSystem)
  const setRole = useCounselorStore((s) => s.setRole)

  useEffect(() => {
    setRole(role)
    setSystem(system)
  }, [role, system, setRole, setSystem])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <CounselorsLayout />
    </SWRConfig>
  )
}

'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import MaintenanceLayout from '@/components/MaintenanceLayout'
import { useMaintenanceStore } from '@/store/useMaintenanceStore'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export default function MaintenanceClient({ role, system }: { role: UserRole; system: SheetSystem }) {
  const setSystem = useMaintenanceStore((s) => s.setSystem)
  const setRole = useMaintenanceStore((s) => s.setRole)

  useEffect(() => {
    setRole(role)
    setSystem(system)
  }, [role, system, setRole, setSystem])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <MaintenanceLayout />
    </SWRConfig>
  )
}

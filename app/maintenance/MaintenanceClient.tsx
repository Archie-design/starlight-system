'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import MaintenanceLayout from '@/components/MaintenanceLayout'
import { useMaintenanceStore } from '@/store/useMaintenanceStore'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export default function MaintenanceClient({ role, system, username }: { role: UserRole; system: SheetSystem; username: string }) {
  const setSystem = useMaintenanceStore((s) => s.setSystem)
  const setRole = useMaintenanceStore((s) => s.setRole)
  const setUsername = useMaintenanceStore((s) => s.setUsername)

  useEffect(() => {
    setRole(role)
    setSystem(system)
    setUsername(username)
  }, [role, system, username, setRole, setSystem, setUsername])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <MaintenanceLayout />
    </SWRConfig>
  )
}

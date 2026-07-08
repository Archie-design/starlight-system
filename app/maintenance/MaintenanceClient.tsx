'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import MaintenanceLayout from '@/components/MaintenanceLayout'
import { useMaintenanceStore } from '@/store/useMaintenanceStore'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

export default function MaintenanceClient({ role, system, username, displayName }: { role: UserRole; system: SheetSystem; username: string; displayName: string | null }) {
  const setSystem = useMaintenanceStore((s) => s.setSystem)
  const setRole = useMaintenanceStore((s) => s.setRole)
  const setUsername = useMaintenanceStore((s) => s.setUsername)
  const setDisplayName = useMaintenanceStore((s) => s.setDisplayName)

  useEffect(() => {
    setRole(role)
    setSystem(system)
    setUsername(username)
    setDisplayName(displayName)
  }, [role, system, username, displayName, setRole, setSystem, setUsername, setDisplayName])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <MaintenanceLayout />
    </SWRConfig>
  )
}

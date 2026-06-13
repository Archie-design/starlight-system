'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import MaintenanceLayout from '@/components/MaintenanceLayout'
import { useMaintenanceStore } from '@/store/useMaintenanceStore'
import type { SheetSystem } from '@/lib/supabase/types'

export default function MaintenanceClient({ system }: { system: SheetSystem }) {
  const setSystem = useMaintenanceStore((s) => s.setSystem)

  useEffect(() => {
    setSystem(system)
  }, [system, setSystem])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <MaintenanceLayout />
    </SWRConfig>
  )
}

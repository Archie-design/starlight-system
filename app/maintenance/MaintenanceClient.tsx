'use client'

import { SWRConfig } from 'swr'
import MaintenanceLayout from '@/components/MaintenanceLayout'

export default function MaintenanceClient() {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <MaintenanceLayout />
    </SWRConfig>
  )
}

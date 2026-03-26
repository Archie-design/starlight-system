'use client'

import { SWRConfig } from 'swr'
import CounselorsLayout from '@/components/CounselorsLayout'

export default function CounselorsClient() {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <CounselorsLayout />
    </SWRConfig>
  )
}

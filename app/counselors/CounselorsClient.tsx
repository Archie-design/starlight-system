'use client'

import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import CounselorsLayout from '@/components/CounselorsLayout'
import { useCounselorStore } from '@/store/useCounselorStore'
import type { SheetSystem } from '@/lib/supabase/types'

export default function CounselorsClient({ system }: { system: SheetSystem }) {
  const setSystem = useCounselorStore((s) => s.setSystem)

  useEffect(() => {
    setSystem(system)
  }, [system, setSystem])

  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <CounselorsLayout />
    </SWRConfig>
  )
}

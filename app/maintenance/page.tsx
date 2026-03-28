import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceClient from './MaintenanceClient'

export default async function MaintenancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <MaintenanceClient />
}

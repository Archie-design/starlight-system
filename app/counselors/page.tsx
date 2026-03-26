import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CounselorsClient from './CounselorsClient'

export default async function CounselorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <CounselorsClient />
}

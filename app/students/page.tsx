import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentsClient from './StudentsClient'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <StudentsClient />
}

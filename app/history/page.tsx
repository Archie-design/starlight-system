import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.must_change_password) redirect('/account/change-password')
  return <HistoryClient />
}

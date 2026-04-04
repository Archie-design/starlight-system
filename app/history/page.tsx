import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  if (!(await checkAuth())) redirect('/login')
  return <HistoryClient />
}

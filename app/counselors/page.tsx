import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import CounselorsClient from './CounselorsClient'

export default async function CounselorsPage() {
  if (!(await checkAuth())) redirect('/login')
  return <CounselorsClient />
}

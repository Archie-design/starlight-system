import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import StudentsClient from './StudentsClient'

export default async function StudentsPage() {
  if (!(await checkAuth())) redirect('/login')
  return <StudentsClient />
}

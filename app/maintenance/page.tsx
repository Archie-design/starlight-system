import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import MaintenanceClient from './MaintenanceClient'

export default async function MaintenancePage() {
  if (!(await checkAuth())) redirect('/login')

  return <MaintenanceClient />
}

import { redirect } from 'next/navigation'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import MaintenanceClient from './MaintenanceClient'

export default async function MaintenancePage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.must_change_password) redirect('/account/change-password')

  const system = await getEffectiveSystem(user!)
  return <MaintenanceClient role={user!.role} system={system} username={user!.username} displayName={user!.display_name} />
}

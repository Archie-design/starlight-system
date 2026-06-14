import { redirect } from 'next/navigation'
import { checkAuth, getEffectiveSystem } from '@/lib/auth'
import CounselorsClient from './CounselorsClient'

export default async function CounselorsPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.must_change_password) redirect('/account/change-password')

  const system = await getEffectiveSystem(user!)
  return <CounselorsClient role={user!.role} system={system} username={user!.username} />
}

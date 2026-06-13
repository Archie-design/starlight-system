import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import { APP_NAME } from '@/lib/config'
import LoginLogsClient from './LoginLogsClient'

export const metadata = {
  title: `登入紀錄 — ${APP_NAME}`,
}

export default async function LoginLogsPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.role !== 'superadmin') redirect('/students')
  if (user!.must_change_password) redirect('/account/change-password')

  return <LoginLogsClient />
}

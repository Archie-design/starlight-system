import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import { APP_NAME } from '@/lib/config'
import UsersClient from './UsersClient'

export const metadata = {
  title: `帳號管理 — ${APP_NAME}`,
}

export default async function AdminUsersPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.role === 'admin') redirect('/students') // 僅 superadmin / system_admin 可管理
  if (user!.must_change_password) redirect('/account/change-password')

  return <UsersClient actorRole={user!.role} actorSystem={user!.system} />
}

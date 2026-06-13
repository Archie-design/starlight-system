import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import UsersClient from './UsersClient'

export const metadata = {
  title: '帳號管理 — 星光超級表格系統',
}

export default async function AdminUsersPage() {
  const { valid, user } = await checkAuth()
  if (!valid) redirect('/login')
  if (user!.role !== 'superadmin') redirect('/students')
  if (user!.must_change_password) redirect('/account/change-password')

  return <UsersClient />
}

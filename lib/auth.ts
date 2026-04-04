import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'sl_session'

export async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  return cookieStore.get(SESSION_COOKIE)?.value === secret
}

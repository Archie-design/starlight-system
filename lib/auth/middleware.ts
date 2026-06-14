import { NextRequest } from 'next/server'
import { checkAuth } from '@/lib/auth'
import type { AuthUser } from '@/lib/supabase/types'

/**
 * API 路由認證中間件
 * 使用方式：
 *   if (!await requireAuth(request)) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   }
 */
export async function requireAuth(request: NextRequest): Promise<boolean> {
  const authResult = await checkAuth(request)
  return authResult.valid
}

/**
 * 取得經認證的使用者（含 role / system）；認證失敗回 null。
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authResult = await checkAuth(request)
  return authResult.valid ? (authResult.user ?? null) : null
}

/**
 * 要求 superadmin；非 superadmin 或未登入回 null。
 */
export async function requireSuperadmin(request: NextRequest): Promise<AuthUser | null> {
  const user = await getAuthUser(request)
  return user?.role === 'superadmin' ? user : null
}

/**
 * 要求「可管理」角色（superadmin 或 system_admin）；否則回 null。
 * superadmin 跨體系；system_admin 僅限同體系（由呼叫端依 user.system 過濾）。
 */
export async function requireManager(request: NextRequest): Promise<AuthUser | null> {
  const user = await getAuthUser(request)
  return user && (user.role === 'superadmin' || user.role === 'system_admin') ? user : null
}

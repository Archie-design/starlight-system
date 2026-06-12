import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth'

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
 * 取得經認證用戶的電子郵件
 * 如果認證失敗或未設置 email，返回 null
 */
export async function getAuthenticatedEmail(request: NextRequest): Promise<string | null> {
  const authResult = await checkAuth(request)
  return authResult.valid ? (authResult.email ?? null) : null
}

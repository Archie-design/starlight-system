import { NextResponse } from 'next/server'

/**
 * 統一的 500 錯誤回應（P2 #25）。
 *
 * 原本許多 route 直接把 Supabase 底層錯誤（`error.message`）回傳給前端，
 * 可能洩漏資料表結構、欄位名稱、約束（constraint）名稱等內部實作細節給
 * 客戶端。改為：完整錯誤內容寫進 server log（方便排查），對外一律回傳
 * 通用訊息。
 *
 * @param context 供 server log 辨識是哪個 route/操作出錯（例如 'counselor-groups GET'）
 * @param error Supabase 回傳的 error 物件，或任意 catch 到的 unknown 錯誤
 */
export function serverErrorResponse(context: string, error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[${context}]`, message)
  return NextResponse.json({ error: '伺服器發生錯誤，請稍後再試' }, { status: 500 })
}

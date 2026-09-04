/**
 * 全站統一的 Toast 提示——取代先前散落在各 hook/元件的 `alert()` 呼叫
 * （瀏覽器原生 alert 是阻斷式彈窗，樣式無法客製，且跟系統其餘的 inline
 * 錯誤訊息模式不一致）。
 *
 * 刻意不用 React Context：多數呼叫端是純 `.ts` hook 檔案（例如
 * useGroupManagement.ts），本身沒有 JSX 可以掛 Provider，而且 hook 檔案
 * 裡的 async 函式（handleCreateGroup 等）不見得每次呼叫都保證仍在合法的
 * React render/effect 流程內（例如使用者離開頁面後才 resolve 的
 * fetch），用 useContext 在這些位置呼叫在 React 規則上更脆弱。改用模組級
 * 單例（pub-sub）：任何檔案 `import { toast } from '@/lib/toast'` 都能
 * 直接呼叫，不受 hook 呼叫規則限制；`<Toaster />` 訂閱這個 store 並在
 * app/layout.tsx 掛載一次即可涵蓋全站。
 */

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  /** 幾毫秒後自動移除；0 表示不自動消失（需使用者手動關閉） */
  duration: number
}

type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener(items)
}

function push(message: string, variant: ToastVariant, duration: number) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  items = [...items, { id, message, variant, duration }]
  emit()
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id: string) {
  items = items.filter((t) => t.id !== id)
  emit()
}

/** `<Toaster />` 用來訂閱目前的 toast 清單；回傳取消訂閱函式 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener(items)
  return () => listeners.delete(listener)
}

export const toast = {
  /** 預設 5 秒後自動消失——失敗訊息通常需要比成功訊息多一點時間閱讀 */
  error: (message: string, duration = 5000) => push(message, 'error', duration),
  success: (message: string, duration = 3000) => push(message, 'success', duration),
  info: (message: string, duration = 4000) => push(message, 'info', duration),
  dismiss,
}

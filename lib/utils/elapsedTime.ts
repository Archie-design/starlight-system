/**
 * 相對經過時間格式化（供 FilterBar 顯示「距上次匯入 X 天 Y 小時」用）。
 * 純函式，方便獨立測試；不依賴 React 或瀏覽器環境。
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 把「上次匯入時間」與「現在時間」的差距，格式化成人類可讀的經過時間文字：
 * - null（從未匯入過）→ 「尚無匯入紀錄」
 * - < 1 小時 → 「N 分鐘」（不滿 1 分鐘顯示「不到 1 分鐘」）
 * - >= 1 小時 → 「N 天 M 小時」（不滿 1 天時天數為 0，僅顯示小時；
 *   見 formatElapsedParts 決定是否省略「0 天」）
 *
 * @param lastImportAt ISO 時間字串，或 null（尚無匯入紀錄）
 * @param now 現在時間（毫秒 timestamp）；預設 Date.now()，測試時可傳入固定值
 */
export function formatElapsedSinceImport(lastImportAt: string | null | undefined, now: number = Date.now()): string {
  if (!lastImportAt) return '尚無匯入紀錄'

  const then = new Date(lastImportAt).getTime()
  if (Number.isNaN(then)) return '尚無匯入紀錄'

  const diff = Math.max(0, now - then)

  if (diff < MINUTE) return '距上次匯入不到 1 分鐘'
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE)
    return `距上次匯入 ${minutes} 分鐘`
  }

  const days = Math.floor(diff / DAY)
  const hours = Math.floor((diff % DAY) / HOUR)

  if (days === 0) return `距上次匯入 ${hours} 小時`
  return `距上次匯入 ${days} 天 ${hours} 小時`
}

/**
 * 西元年轉民國年
 * "2025/08/02" | Date → "114.08.02"
 */
export function toROCDate(input: string | Date | null | undefined): string | null {
  if (!input) return null
  try {
    let date: Date
    if (input instanceof Date) {
      date = input
    } else {
      const str = String(input).trim()
      // 支援 "2025/08/02" 和 "2025-08-02" 格式
      date = new Date(str.replace(/\//g, '-'))
    }
    if (isNaN(date.getTime())) return null
    const rocYear = date.getFullYear() - 1911
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${rocYear}.${month}.${day}`
  } catch {
    return null
  }
}

/**
 * 民國年轉西元 Date
 * "114.08.02" → Date(2025-08-02)
 */
export function fromROCDate(roc: string | null | undefined): Date | null {
  if (!roc) return null
  const match = String(roc).trim().match(/^(\d+)\.(\d{2})\.(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1], 10) + 1911
  const month = parseInt(match[2], 10) - 1
  const day = parseInt(match[3], 10)
  return new Date(year, month, day)
}

/**
 * 將 Date 格式化為 YYYY-MM-DD（使用本地時間，避免 toISOString UTC 偏移問題）
 */
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 將 Excel 日期物件/字串 正規化為 Date (去除時間部分)
 */
export function normalizeDate(input: Date | string | null | undefined): Date | null {
  if (!input) return null
  try {
    const d = input instanceof Date ? input : new Date(String(input).replace(/\//g, '-'))
    if (isNaN(d.getTime())) return null
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  } catch {
    return null
  }
}

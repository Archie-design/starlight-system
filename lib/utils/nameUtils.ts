/**
 * 解析 "568_王晴臻" 格式
 * 返回 { id: 568, name: "王晴臻" }
 */
export function parseNameWithId(raw: string | null | undefined): { id: number | null; name: string } {
  if (!raw) return { id: null, name: '' }
  const str = String(raw).trim()
  const match = str.match(/^(\d+)_(.+)$/)
  if (match) {
    return { id: parseInt(match[1], 10), name: match[2] }
  }
  return { id: null, name: str }
}

/**
 * 提取裸名 "568_王晴臻" → "王晴臻"，無前綴則原樣返回
 */
export function extractBareName(raw: string | null | undefined): string {
  if (!raw) return ''
  return parseNameWithId(raw).name
}

/**
 * 格式化顯示 id + name → "568_王晴臻"
 */
export function formatNameWithId(id: number, name: string): string {
  return `${id}_${name}`
}

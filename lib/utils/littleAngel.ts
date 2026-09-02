import { parseNameWithId, extractBareName } from './nameUtils'

/**
 * 小天使從屬關係的資料品質偵測（小天使專區用）。
 *
 * `little_angel` 欄位格式與 `introducer` 相同（"ID_姓名"），但這裡獨立成
 * 一組 helper 而非塞進 buildTree.ts，因為這些檢查不是建樹過程本身的一部分
 * ——是建樹「之外」的資料品質分析，呼叫端會搭配 buildTree() 的
 * brokenCycleIds 一起組成完整的資料品質清單（見 design.md 決策 2、3）。
 */

export interface LittleAngelStudent {
  id: number
  name: string
  little_angel: string | null
}

/**
 * 偵測「自我指向」：學員的 little_angel 解析出的 id 等於自己的 id。
 *
 * 這個案例 buildTree() 不會回報——它在建樹時用 `parent !== node` 提早排除，
 * 根本不會進入 parentMap，因此也不會走到 DFS 循環偵測（resolveNode 的
 * inPath 檢查）那條路徑。必須用這支獨立的檢查才能抓到。
 */
export function findSelfReferences<T extends LittleAngelStudent>(students: T[]): T[] {
  return students.filter((s) => {
    const { id } = parseNameWithId(s.little_angel)
    return id !== null && id === s.id
  })
}

export interface DanglingPointer<T extends LittleAngelStudent> {
  student: T
  /** 原始填寫的 little_angel 文字值 */
  pointsTo: string
}

/**
 * 偵測「懸空指標」：little_angel 解析出的 id（或裸名 fallback）在目前資料集
 * 中找不到對應學員。
 *
 * 依實際資料驗證：這是目前最常見的異常案例（抽樣的「疑似多層鏈」小天使，
 * 11 筆裡 11 筆都是這個情況，而非真正的多層從屬——見 design.md 決策 4）。
 *
 * @param students 目前有效體系內的完整學員清單（用來判斷「找不到對應學員」
 *                 的範圍——體系外的學員不算存在，即便該 ID 在其他體系真實存在）
 */
export function findDanglingPointers<T extends LittleAngelStudent>(students: T[]): DanglingPointer<T>[] {
  const byId = new Map<number, T>()
  const byName = new Map<string, T>()
  for (const s of students) {
    byId.set(s.id, s)
    byName.set(s.name, s)
  }

  const results: DanglingPointer<T>[] = []
  for (const s of students) {
    if (!s.little_angel) continue
    const { id: parsedId } = parseNameWithId(s.little_angel)

    // 自我指向不算懸空指標（是另一種獨立的資料品質案例，見 findSelfReferences）
    if (parsedId !== null && parsedId === s.id) continue

    const resolvedById = parsedId !== null ? byId.get(parsedId) : undefined
    if (resolvedById) continue

    const bareName = extractBareName(s.little_angel)
    const resolvedByName = byName.get(bareName)
    if (resolvedByName) continue

    results.push({ student: s, pointsTo: s.little_angel })
  }
  return results
}

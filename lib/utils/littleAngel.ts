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

export interface CrossSystemPointer<T extends LittleAngelStudent> {
  student: T
  /** 原始填寫的 little_angel 文字值 */
  pointsTo: string
  /** 解析出的小天使在全域資料中的實際姓名（供顯示，比只顯示 ID 更有用） */
  targetName: string
  /** 該小天使實際所屬的體系（例如 '太陽'），與 student 自己的體系不同 */
  targetSystem: string
}

/** 跨體系比對表只需要 id/name/business_chain，不要求 little_angel（它是查找表，不是被掃描對象） */
type MinimalCrossSystemLookup = { id: number; name: string; business_chain?: string | null }

/**
 * 偵測「懸空指標」與「跨體系指派」，兩者過去被合併判定為同一種「懸空指標」
 * （little_angel 在目前體系查無此人），但實際上是不同性質的問題：
 * - 懸空指標：整個資料庫都查無此人，可能是資料填寫錯誤或該學員記錄已被刪除
 * - 跨體系指派：此人確實存在，只是屬於另一個體系——業務邏輯上小天使通常該
 *   同體系，這種情況更可能是填寫錯誤而非「查無此人」，需要分開呈現才有意義
 *   （否則使用者看到 `(id 13295)` 只會以為是髒資料，實際上是可以查到、
 *   只是跨了體系的真人）。
 *
 * 依實際資料驗證：在只看單一體系、不分辨跨體系的情況下，這是目前最常見的
 * 異常案例（抽樣的「疑似多層鏈」小天使，11 筆裡 11 筆都落在這兩類之一，
 * 而非真正的多層從屬——見 design.md 決策 4）。
 *
 * @param students 目前有效體系內的完整學員清單（判斷「找不到對應學員」的
 *                 主要範圍）
 * @param allStudentsById 全體系（不限目前有效體系）的 id → 學員對照表，
 *                 用來把「目前體系找不到」的案例進一步區分成懸空指標或
 *                 跨體系指派。未提供時等同於只看 students（不區分兩者，
 *                 全部歸類為懸空指標）。
 * @param systemOfFn 給定學員判斷其所屬體系的函式（例如既有的 systemOf()）
 */
export function findDanglingAndCrossSystemPointers<T extends LittleAngelStudent & { business_chain?: string | null }>(
  students: T[],
  allStudentsById: Map<number, MinimalCrossSystemLookup> | undefined,
  systemOfFn: (businessChain: string | null | undefined) => string,
): { dangling: DanglingPointer<T>[]; crossSystem: CrossSystemPointer<T>[] } {
  const byId = new Map<number, T>()
  const byName = new Map<string, T>()
  for (const s of students) {
    byId.set(s.id, s)
    byName.set(s.name, s)
  }

  const dangling: DanglingPointer<T>[] = []
  const crossSystem: CrossSystemPointer<T>[] = []

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

    // 目前體系內找不到——查一下全域資料，看是真的不存在還是跨體系
    const globalMatch = parsedId !== null ? allStudentsById?.get(parsedId) : undefined
    if (globalMatch) {
      crossSystem.push({
        student: s,
        pointsTo: s.little_angel,
        targetName: globalMatch.name,
        targetSystem: systemOfFn(globalMatch.business_chain),
      })
    } else {
      dangling.push({ student: s, pointsTo: s.little_angel })
    }
  }
  return { dangling, crossSystem }
}

import { parseNameWithId } from '@/lib/utils/nameUtils'

interface GroupDef {
  name: string
  root_student_ids: number[]
}

interface StudentEntry {
  id: number
  counselor: string | null
  introducer: string | null
}

/**
 * 依輔導員鏈（優先）或介紹人鏈（備援）自動判定學員所屬分組。
 *
 * 邏輯：
 * 1. 先沿 counselor（輔導員）欄位向上追溯，命中根節點即返回組名。
 * 2. 若輔導員鏈無法解析，再改沿 introducer（介紹人）欄位追溯。
 *
 * @param studentMap  student id → { id, counselor, introducer }
 * @param groups      counselor_groups 清單（含 root_student_ids）
 * @returns           student id → group name
 */
export function buildGroupAssignments(
  studentMap: Map<number, StudentEntry>,
  groups: GroupDef[],
  aliases: Record<number, number> = {}
): Map<number, string> {
  // 根節點 id → 組名
  const rootToGroup = new Map<number, string>()
  for (const g of groups) {
    for (const rid of g.root_student_ids) {
      rootToGroup.set(rid, g.name)
    }
  }

  const MAX_DEPTH = 25
  const result = new Map<number, string>()

  // 各自獨立快取，避免不同追溯路徑互相污染
  const counselorCache = new Map<number, string | null>()
  const introducerCache = new Map<number, string | null>()

  function resolveVia(
    studentId: number,
    field: 'counselor' | 'introducer',
    cache: Map<number, string | null>,
    depth: number
  ): string | null {
    if (depth > MAX_DEPTH) return null
    if (cache.has(studentId)) return cache.get(studentId)!

    // 是否為根節點本身？
    const groupName = rootToGroup.get(studentId)
    if (groupName) {
      cache.set(studentId, groupName)
      return groupName
    }

    const student = studentMap.get(studentId)
    const raw = student?.[field] ?? null
    if (!raw) {
      cache.set(studentId, null)
      return null
    }

    let { id: nextId } = parseNameWithId(raw)
    
    // 核心代理邏輯：若路徑中遇到被代管的 ID，直接跳轉到代理 ID
    if (nextId && aliases[nextId]) {
      nextId = aliases[nextId]
    }

    if (!nextId) {
      cache.set(studentId, null)
      return null
    }

    const resolved = resolveVia(nextId, field, cache, depth + 1)
    cache.set(studentId, resolved)
    return resolved
  }

  for (const [id] of studentMap) {
    // 優先沿輔導員鏈追溯
    let group = resolveVia(id, 'counselor', counselorCache, 0)
    // 若輔導員鏈無解，再試介紹人鏈
    if (!group) group = resolveVia(id, 'introducer', introducerCache, 0)
    if (group) result.set(id, group)
  }

  return result
}

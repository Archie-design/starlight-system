import { parseNameWithId } from '@/lib/utils/nameUtils'

interface GroupDef {
  name: string
  root_student_ids: number[]
}

/**
 * 依介紹人鏈自動判定學員所屬分組。
 *
 * 邏輯：對每個 student，沿 introducer 欄位向上追溯（最多 MAX_DEPTH 層），
 * 第一個命中任一根節點 ID 即返回對應組名。
 *
 * @param studentMap      student id → { id, introducer }
 * @param groups          counselor_groups 清單（含 root_student_ids）
 * @returns               student id → group name
 */
export function buildGroupAssignments(
  studentMap: Map<number, { id: number; introducer: string | null }>,
  groups: GroupDef[]
): Map<number, string> {
  // 建立根節點 id → 組名 的快速查找
  const rootToGroup = new Map<number, string>()
  for (const g of groups) {
    for (const rid of g.root_student_ids) {
      rootToGroup.set(rid, g.name)
    }
  }

  const MAX_DEPTH = 25
  const result = new Map<number, string>()
  // 快取已知歸屬，避免重複追溯
  const cache = new Map<number, string | null>()

  function resolve(studentId: number, depth: number): string | null {
    if (depth > MAX_DEPTH) return null
    if (cache.has(studentId)) return cache.get(studentId)!

    // 是否為根節點？
    const groupName = rootToGroup.get(studentId)
    if (groupName) {
      cache.set(studentId, groupName)
      return groupName
    }

    const student = studentMap.get(studentId)
    if (!student?.introducer) {
      cache.set(studentId, null)
      return null
    }

    const { id: introducerId } = parseNameWithId(student.introducer)
    if (!introducerId) {
      cache.set(studentId, null)
      return null
    }

    const resolved = resolve(introducerId, depth + 1)
    cache.set(studentId, resolved)
    return resolved
  }

  for (const [id] of studentMap) {
    const group = resolve(id, 0)
    if (group) result.set(id, group)
  }

  return result
}

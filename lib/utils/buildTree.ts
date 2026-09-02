import { parseNameWithId, extractBareName } from './nameUtils'

export interface OrgStudent {
  id: number
  name: string
  role: string | null
  region: string | null
  introducer: string | null
  course_1: string | null
  course_2: string | null
  course_3: string | null
  course_4: string | null
  course_5: string | null
  course_wuyun: string | null
  life_numbers: string | null
  life_numbers_advanced: string | null
  life_transform: string | null
  debt_release: string | null
  gender?: string | null
  counselor?: string | null
  business_chain?: string | null
  senior_counselor?: string | null
  guidance_chain?: string | null
  relation?: string | null
  membership_expiry?: string | null
  birthday?: string | null
  spirit_ambassador_group?: string | null
  little_angel?: string | null
}

export interface TreeNode {
  student: OrgStudent
  children: TreeNode[]
  depth: number
}

export interface BuildTreeResult {
  roots: TreeNode[]
  /**
   * 因偵測到循環而被強制打斷父節點連結、變成新根節點的學員 id 清單。
   * 注意：只有「雙向互指」等真正走到 DFS 循環偵測（resolveNode 的 inPath
   * 檢查）的情況才會出現在這裡；「自我指向」（parent === node）在更早的
   * `if (parent && parent !== node)` 判斷就被排除，根本不會進入
   * parentMap，因此不會被計入這裡——呼叫端若要偵測自我指向，須另外自行
   * 檢查 `parseNameWithId(student[parentField]).id === student.id`。
   */
  brokenCycleIds: number[]
}

export function buildTree(
  students: OrgStudent[],
  parentField: keyof OrgStudent,
  aliases: Record<number, number> = {},
  overrides: Record<number, number> = {}
): BuildTreeResult {
  const nodeById = new Map<number, TreeNode>()
  const nodeByName = new Map<string, TreeNode>()

  // 建立所有節點
  for (const student of students) {
    const node: TreeNode = { student, children: [], depth: 0 }
    nodeById.set(student.id, node)
    nodeByName.set(student.name, node)
  }

  const parentMap = new Map<TreeNode, TreeNode>()

  for (const student of students) {
    const node = nodeById.get(student.id)!
    let parent: TreeNode | undefined

    const parentRef = student[parentField] as string | null | undefined
    if (parentRef) {
      let { id: parsedId } = parseNameWithId(parentRef)

      // 核心代理邏輯：若有個別學生強制換線，優先套用
      if (overrides[student.id]) {
        parsedId = overrides[student.id]
      } else if (parsedId !== null && aliases[parsedId]) {
        parsedId = aliases[parsedId]
      }

      if (parsedId !== null) {
        parent = nodeById.get(parsedId)
      }

      if (!parent) {
        const bareName = extractBareName(parentRef)
        parent = nodeByName.get(bareName)
      }
    }

    if (parent && parent !== node) {
      parentMap.set(node, parent)
    }
  }

  // 3. Cycle breaking
  const roots: TreeNode[] = []
  const resolved = new Set<TreeNode>()
  const inPath = new Set<TreeNode>()
  const brokenCycleIds: number[] = []

  function resolveNode(node: TreeNode) {
    if (resolved.has(node)) return
    if (inPath.has(node)) {
      // 打破迴圈！這顆節點將變成 Root
      parentMap.delete(node)
      brokenCycleIds.push(node.student.id)
      return
    }

    inPath.add(node)
    const p = parentMap.get(node)
    if (p) {
      resolveNode(p)
    }
    inPath.delete(node)
    resolved.add(node)
  }

  for (const node of nodeById.values()) {
    resolveNode(node)
  }

  // 4. Assemble children
  for (const node of nodeById.values()) {
    const p = parentMap.get(node)
    if (p) {
      p.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // 5. Assign depth
  function assignDepth(node: TreeNode, d: number) {
    node.depth = d
    for (const c of node.children) {
      assignDepth(c, d + 1)
    }
  }
  for (const root of roots) {
    assignDepth(root, 0)
  }

  return { roots, brokenCycleIds }
}

/** 從根節點陣列找到目標 id 的完整路徑（從根到目標，含目標本身） */
export function findPath(roots: TreeNode[], targetId: number): TreeNode[] {
  function dfs(node: TreeNode, path: TreeNode[]): TreeNode[] | null {
    const next = [...path, node]
    if (node.student.id === targetId) return next
    for (const child of node.children) {
      const result = dfs(child, next)
      if (result) return result
    }
    return null
  }
  for (const root of roots) {
    const result = dfs(root, [])
    if (result) return result
  }
  return []
}

export function countDescendants(node: TreeNode): number {
  let count = node.children.length
  for (const child of node.children) {
    count += countDescendants(child)
  }
  return count
}

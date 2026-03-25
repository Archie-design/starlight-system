import { parseNameWithId, extractBareName } from './nameUtils'

export interface OrgStudent {
  id: number
  name: string
  role: string | null
  region: string | null
  introducer: string | null
}

export interface TreeNode {
  student: OrgStudent
  children: TreeNode[]
  depth: number
}

export function buildTree(students: OrgStudent[]): TreeNode[] {
  const nodeById = new Map<number, TreeNode>()
  const nodeByName = new Map<string, TreeNode>()

  // 建立所有節點
  for (const student of students) {
    const node: TreeNode = { student, children: [], depth: 0 }
    nodeById.set(student.id, node)
    nodeByName.set(student.name, node)
  }

  const roots: TreeNode[] = []

  for (const student of students) {
    const node = nodeById.get(student.id)!
    let parent: TreeNode | undefined

    if (student.introducer) {
      const { id: parsedId } = parseNameWithId(student.introducer)
      if (parsedId !== null) {
        parent = nodeById.get(parsedId)
      }
      if (!parent) {
        const bareName = extractBareName(student.introducer)
        parent = nodeByName.get(bareName)
      }
    }

    if (parent && parent !== node) {
      parent.children.push(node)
      node.depth = parent.depth + 1
    } else {
      roots.push(node)
    }
  }

  return roots
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

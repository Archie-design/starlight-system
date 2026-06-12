'use client'

import { useReducer, useCallback } from 'react'
import { findPath, type TreeNode } from '@/lib/utils/buildTree'

type FocusAction =
  | { type: 'focus'; roots: TreeNode[]; studentId: number }
  | { type: 'breadcrumb'; index: number }

function focusReducer(stack: TreeNode[], action: FocusAction): TreeNode[] {
  switch (action.type) {
    case 'focus': {
      const path = findPath(action.roots, action.studentId)
      return path.length > 0 ? path : stack
    }
    case 'breadcrumb':
      return action.index === -1 ? [] : stack.slice(0, action.index + 1)
    default:
      return stack
  }
}

/**
 * 管理組織圖的聚焦堆疊（focusStack）。
 * - focusNode: 點擊節點時設定完整上線路徑
 * - focusStudent: 由搜尋選取學員時設定路徑
 * - goToBreadcrumb: 麵包屑導覽（-1 = 回到全體系）
 */
export function useOrgChartInteraction(roots: TreeNode[]) {
  const [focusStack, dispatch] = useReducer(focusReducer, [])

  const focusNode = useCallback(
    (node: TreeNode) => dispatch({ type: 'focus', roots, studentId: node.student.id }),
    [roots]
  )

  const focusStudent = useCallback(
    (studentId: number) => dispatch({ type: 'focus', roots, studentId }),
    [roots]
  )

  const goToBreadcrumb = useCallback(
    (index: number) => dispatch({ type: 'breadcrumb', index }),
    []
  )

  return { focusStack, focusNode, focusStudent, goToBreadcrumb }
}

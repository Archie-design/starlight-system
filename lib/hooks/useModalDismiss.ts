'use client'

import { useEffect, useRef } from 'react'

/**
 * Modal 無障礙輔助：
 * - 按 Escape 關閉
 * - 開啟時將焦點移入 Modal，並把焦點限制在 Modal 內（focus trap）
 *
 * @param onClose 關閉 Modal 的 callback
 * @param active  Modal 是否開啟（false 時不掛事件）
 * @returns ref 需掛到 Modal 容器 element
 */
export function useModalDismiss<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  active = true
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return

    const node = ref.current
    // 記住開啟前的焦點，關閉後還原
    const previouslyFocused = document.activeElement as HTMLElement | null

    function focusables(): HTMLElement[] {
      if (!node) return []
      return Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
    }

    // 開啟時將焦點移入 Modal
    const first = focusables()[0]
    first?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [onClose, active])

  return ref
}

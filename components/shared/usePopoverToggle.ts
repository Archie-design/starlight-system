'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 共用的「點擊開關 + 點外部關閉」popover 邏輯，供 `MultiSelectDropdown`、
 * `TextFilterPopover`、`RangeFilterPopover` 共用同一套定位與行為。
 */
export function usePopoverToggle<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false)
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return { open, setOpen, ref }
}

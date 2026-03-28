'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface NavButtonProps {
  href: string
  children: React.ReactNode
  className?: string
  active?: boolean
}

export default function NavButton({ href, children, className, active }: NavButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`
        relative inline-flex items-center gap-1.5 transition-all duration-200
        ${isPending ? 'opacity-70 cursor-wait bg-white/10 rounded px-2 -mx-2' : ''}
        ${active ? 'text-white font-bold underline underline-offset-4 decoration-2 decoration-yellow-400' : ''}
        ${className}
      `}
    >
      {isPending && (
        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
      )}
      <span className={isPending ? 'translate-x-0.5' : ''}>
        {isPending ? '載入中…' : children}
      </span>
    </button>
  )
}

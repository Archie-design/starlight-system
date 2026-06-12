import { ROLE_COLORS } from '@/lib/constants'

export function getRoleColor(role: string | null): string {
  return role ? (ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-500') : 'bg-slate-100 text-slate-400'
}

export interface TooltipPos { x: number; y: number }

export type PaymentStatus = '已完款' | '部分付款' | '待付款' | '退款完成' | '未知'

export function normalizePaymentStatus(status: string | null | undefined): PaymentStatus {
  if (!status) return '未知'

  const normalized = status.trim()

  if (normalized.includes('退款') || normalized.includes('refund')) return '退款完成'
  if (normalized.includes('完') || normalized.includes('paid') || normalized.includes('done')) return '已完款'
  if (normalized.includes('部分') || normalized.includes('partial') || normalized.includes('partial')) return '部分付款'
  if (normalized.includes('待') || normalized.includes('pending') || normalized.includes('unpaid')) return '待付款'

  return '未知'
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  '已完款': 'bg-green-100 text-green-700',
  '部分付款': 'bg-amber-100 text-amber-700',
  '待付款': 'bg-red-100 text-red-700',
  '退款完成': 'bg-slate-100 text-slate-700',
  '未知': 'bg-slate-50 text-slate-500',
}

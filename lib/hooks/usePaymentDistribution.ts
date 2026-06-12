'use client'

import { useMemo, useState } from 'react'

interface PaymentRow {
  name: string
  [key: string]: string | number
}

interface DistributionDetail {
  id: number
  name: string
  group_leader?: string
  [key: string]: any
}

export function usePaymentDistribution(
  paymentDistribution: PaymentRow[],
  distributionDetail: DistributionDetail[]
) {
  const [selectedSegment, setSelectedSegment] = useState<{ stage: string; status: string } | null>(null)

  const paymentStatuses = useMemo(() => {
    const statuses = new Set<string>()
    paymentDistribution.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== 'name') statuses.add(k)
      })
    })
    return Array.from(statuses)
  }, [paymentDistribution])

  const sortedStatuses = useMemo(() => {
    const order = ['已完款', '部分付款', '退款完成']
    return paymentStatuses
      .filter(s => order.includes(s))
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }, [paymentStatuses])

  const selectedStudents = useMemo(() => {
    if (!selectedSegment) return []
    const { stage, status } = selectedSegment

    const stageMap: Record<string, { course: string; payment: string }> = {
      '一階': { course: 'course_1', payment: 'payment_1' },
      '二階': { course: 'course_2', payment: 'payment_2' },
      '三階': { course: 'course_3', payment: 'payment_3' },
      '四階': { course: 'course_4', payment: 'payment_4' },
      '五階': { course: 'course_5', payment: 'payment_5' },
      '五運': { course: 'course_wuyun', payment: 'payment_wuyun' },
    }

    const keys = stageMap[stage]
    if (!keys) return []

    const normalize = (val: string | null | undefined): string => {
      if (!val) return '退款完成'
      const v = (val as string).trim()
      if (v === '已完款' || v === '完款' || v === '1' || v === 'true' || v.includes('完款') || v === '已付' || v === '繳清') return '已完款'
      if (/^\d+(\.\d+)?$/.test(v) || v.includes('訂金') || v === '有的') return '部分付款'
      return '退款完成'
    }

    return distributionDetail
      .filter(s => {
        const isEnrolled = !!(s as any)[keys.course]
        const currentStatus = normalize((s as any)[keys.payment])
        return isEnrolled && currentStatus === status
      })
      .map(s => ({
        ...s,
        actualPayment: (s as any)[keys.payment] || '（空白）'
      }))
  }, [selectedSegment, distributionDetail])

  return {
    selectedSegment,
    setSelectedSegment,
    paymentStatuses,
    sortedStatuses,
    selectedStudents,
  }
}

'use client'

import type { FieldDiff } from '@/lib/supabase/types'

// 欄位中文名對照
const FIELD_LABELS: Record<string, string> = {
  gender: '性別', role: '角色', phone: '手機', line_id: 'LINE ID',
  introducer: '介紹人', relation: '與介紹人關係', business_chain: '業務脈', counselor: '輔導員',
  little_angel: '小天使', dream_interpreter: '圓夢解盤員', birthday: '生日',
  senior_counselor: '輔導長', region: '地區', guidance_chain: '輔導脈',
  membership_expiry: '社團會籍', parent_1: '一階家長',
  spirit_ambassador_join_date: '心之使者加入日', love_giving_start_date: '大愛付出起始日',
  spirit_ambassador_group: '心之使者組別', cumulative_seniority: '累積年資',
  course_1: '一階', payment_1: '一階完款/餘額',
  course_2: '二階', payment_2: '二階完款/餘額',
  course_3: '三階', payment_3: '三階完款/餘額',
  course_4: '四階', payment_4: '四階完款/餘額',
  course_5: '五階', payment_5: '五階完款/餘額',
  course_wuyun: '五運', payment_wuyun: '五運完款/餘額',
  wuyun_a: '五運A', wuyun_b: '五運B', wuyun_c: '五運C',
  wuyun_d: '五運D', wuyun_f: '五運F',
  life_numbers: '生命數字', life_numbers_advanced: '生命數字實戰班',
  life_transform: '生命蛻變', debt_release: '生生世世告別負債貧窮',
  system_id: '系統編號',
}

interface Props {
  changes: FieldDiff[]
}

export default function DiffTable({ changes }: Props) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        無欄位變更
      </div>
    )
  }

  return (
    <div className="overflow-auto max-h-96 border rounded">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-gray-100">
          <tr>
            <th className="px-2 py-1.5 text-left border-b font-semibold w-28">學員</th>
            <th className="px-2 py-1.5 text-left border-b font-semibold w-28">欄位</th>
            <th className="px-2 py-1.5 text-left border-b font-semibold">原始值</th>
            <th className="px-2 py-1.5 text-left border-b font-semibold">新值</th>
            <th className="px-2 py-1.5 text-center border-b font-semibold w-16">類型</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((diff, i) => (
            <tr
              key={i}
              className={`border-b hover:bg-white/50 transition-colors ${diff.change_type === 'insert' ? 'bg-emerald-50/30' : 'bg-amber-50/30'}`}
            >
              <td className="px-2 py-2 font-bold text-slate-800 truncate max-w-28">{diff.name}</td>
              <td className="px-2 py-2 text-slate-500 font-medium">
                {FIELD_LABELS[diff.field] ?? diff.field}
              </td>
              <td className="px-2 py-2 text-red-600 font-medium max-w-xs truncate">{diff.old_value ?? '—'}</td>
              <td className="px-2 py-2 text-emerald-700 font-bold max-w-xs truncate">{diff.new_value ?? '—'}</td>
              <td className="px-2 py-1 text-center">
                <span className={`
                  inline-block px-1.5 py-0.5 rounded text-xs font-medium
                  ${diff.change_type === 'insert' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                `}>
                  {diff.change_type === 'insert' ? '新增' : '更新'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

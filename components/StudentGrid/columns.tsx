import { createColumnHelper } from '@tanstack/react-table'
import type { Student } from '@/lib/supabase/types'
import EditableCell from './EditableCell'

const ch = createColumnHelper<Student>()

const editable = (field: keyof Student, header: string, width = 100) =>
  ch.accessor(field, {
    header,
    size: width,
    cell: (info) => (
      <EditableCell
        value={info.getValue() as string | null}
        rowId={info.row.original.id}
        field={field}
      />
    ),
  })

const selectCell = (
  field: keyof Student,
  header: string,
  options: string[],
  width = 80
) =>
  ch.accessor(field, {
    header,
    size: width,
    cell: (info) => (
      <EditableCell
        value={info.getValue() as string | null}
        rowId={info.row.original.id}
        field={field}
        type="select"
        options={options}
      />
    ),
  })

const readonly = (field: keyof Student, header: string, width = 120) =>
  ch.accessor(field, {
    header,
    size: width,
    enableSorting: false,
    cell: (info) => (
      <span className="text-gray-500 text-xs px-1">{info.getValue() as string ?? ''}</span>
    ),
  })

export const studentColumns = [
  // ── 凍結識別欄 ────────────────────────────────────────────
  ch.accessor('id', {
    header: 'ID',
    size: 60,
    enableSorting: true,
    cell: (info) => (
      <span className="font-mono text-xs text-gray-500">{info.getValue()}</span>
    ),
  }),
  ch.accessor('name', {
    header: '姓名',
    size: 100,
    enableSorting: true,
    cell: (info) => (
      <EditableCell
        value={info.getValue()}
        rowId={info.row.original.id}
        field="name"
      />
    ),
  }),
  selectCell('gender', '性別', ['男', '女'], 60),
  ch.accessor('birthday', {
    header: '生日',
    size: 110,
    cell: (info) => (
      <EditableCell
        value={info.getValue()}
        rowId={info.row.original.id}
        field="birthday"
        type="date"
      />
    ),
  }),
  selectCell('role', '角色', [
    '會員', '小天使', '輔導員', '輔導員共同經營',
    '傳愛領袖', '傳愛領袖共同經營',
    '輔導長', '輔導長共同經營',
    '體系長', '體系長共同經營',
  ], 120),

  // ── 聯絡資訊 ──────────────────────────────────────────────
  editable('phone', '手機', 120),
  editable('line_id', 'LINE ID', 120),

  // ── 組織脈絡 ──────────────────────────────────────────────
  editable('introducer', '介紹人', 120),
  editable('relation', '關係人', 100),
  editable('business_chain', '業務脈', 80),
  editable('counselor', '輔導員', 120),
  editable('little_angel', '小天使', 100),

  // ── 心之使者 ──────────────────────────────────────────────
  ch.accessor('spirit_ambassador_join_date', {
    header: '心之使者加入日',
    size: 120,
    cell: (info) => (
      <EditableCell value={info.getValue()} rowId={info.row.original.id}
        field="spirit_ambassador_join_date" type="date" />
    ),
  }),
  ch.accessor('love_giving_start_date', {
    header: '大愛付出起始日',
    size: 120,
    cell: (info) => (
      <EditableCell value={info.getValue()} rowId={info.row.original.id}
        field="love_giving_start_date" type="date" />
    ),
  }),
  editable('spirit_ambassador_group', '心之使者組別', 100),
  editable('cumulative_seniority', '累積年資', 80),

  editable('dream_interpreter', '圓夢解盤員', 100),
  editable('senior_counselor', '輔導長', 120),
  selectCell('region', '地區', ['北區', '中區', '南區'], 80),
  editable('guidance_chain', '輔導脈', 80),
  ch.accessor('membership_expiry', {
    header: '社團會籍',
    size: 110,
    cell: (info) => (
      <EditableCell
        value={info.getValue()}
        rowId={info.row.original.id}
        field="membership_expiry"
        type="date"
      />
    ),
  }),

  // ── 一階課程 ──────────────────────────────────────────────
  editable('course_1', '一階', 100),
  editable('payment_1', '一階完款/餘額', 110),
  editable('parent_1', '一階家長', 100),

  // ── 二階 ─────────────────────────────────────────────────
  editable('course_2', '二階', 100),
  editable('payment_2', '二階完款/餘額', 110),

  // ── 三階 ─────────────────────────────────────────────────
  editable('course_3', '三階', 100),
  editable('payment_3', '三階完款/餘額', 110),

  // ── 四階 ─────────────────────────────────────────────────
  editable('course_4', '四階', 100),
  editable('payment_4', '四階完款/餘額', 110),

  // ── 五階 ─────────────────────────────────────────────────
  editable('course_5', '五階', 100),
  editable('payment_5', '五階完款/餘額', 110),

  // ── 五運班 ────────────────────────────────────────────────
  editable('course_wuyun', '五運', 80),
  editable('payment_wuyun', '五運完款/餘額', 110),
  editable('wuyun_a', '五運A', 80),
  editable('wuyun_b', '五運B', 80),
  editable('wuyun_c', '五運C', 80),
  editable('wuyun_d', '五運D', 80),
  editable('wuyun_f', '五運F', 80),

  // ── 特殊課程 ──────────────────────────────────────────────
  editable('life_numbers', '生命數字', 100),
  editable('life_numbers_advanced', '生命數字實戰班', 110),
  editable('life_transform', '生命蛻變', 100),
  editable('debt_release', '生生世世告別負債貧窮', 150),

  // ── 輔導長分組 ───────────────────────────────────────────────
  editable('group_leader', '所屬分組', 120),

  // ── 計算欄 (唯讀) ─────────────────────────────────────────
  ch.display({
    id: 'name_with_id',
    header: '學員(含學編)',
    size: 120,
    cell: (info) => (
      <span className="text-gray-400 text-xs">{info.row.original.name_with_id}</span>
    ),
  }),
  ch.display({
    id: 'course_summary',
    header: '上課梯次',
    size: 200,
    enableSorting: false,
    cell: (info) => {
      const s = info.row.original
      const parts = [
        s.course_1, s.course_2, s.course_3, s.course_4, s.course_5, s.course_wuyun,
      ].filter(Boolean)
      return <span className="text-gray-400 text-xs">{parts.join(' / ')}</span>
    },
  }),
]

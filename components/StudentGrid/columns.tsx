import { createColumnHelper } from '@tanstack/react-table'
import type { Student } from '@/lib/supabase/types'
import { SORTABLE_FIELDS } from '@/lib/utils/columnFilter'
import EditableCell from './EditableCell'

const ch = createColumnHelper<Student>()

/**
 * 是否顯示排序控制，讀取跟後端共用的同一份白名單（`SORTABLE_FIELDS`），
 * 避免表頭顯示排序圖示、但後端未支援排序該欄位（點了沒反應）的落差。
 */
const isSortable = (field: string) => SORTABLE_FIELDS.has(field)

/**
 * 表頭逐欄篩選/排序的白名單中介資料。
 * - `filterable`：該欄位表頭要不要顯示篩選圖示、用哪種篩選面板
 *   （'text' 包含比對／'enum' 複選／'range' 日期或數值區間）。
 * - `sortable`：該欄位要不要顯示排序控制。僅原生資料庫欄位可標記，
 *   衍生計算欄（如課程進度、上課梯次彙總）不開放排序，避免要在
 *   已下推分頁的資料上做二次排序而導致跨頁排序錯誤。
 * 後端只信任這份白名單內的 key，其餘一律忽略。
 */
export interface StudentColumnMeta {
  filterable?: 'text' | 'enum' | 'range'
  enumOptions?: string[]
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> extends StudentColumnMeta {}
}

const editable = (field: keyof Student, header: string, width = 100, meta?: StudentColumnMeta) =>
  ch.accessor(field, {
    header,
    size: width,
    meta,
    enableSorting: isSortable(field),
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
    meta: { filterable: 'enum', enumOptions: options },
    enableSorting: isSortable(field),
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
      <span className="block font-mono text-xs text-gray-500 px-2">{info.getValue()}</span>
    ),
  }),
  ch.accessor('name', {
    header: '姓名',
    size: 100,
    enableSorting: true,
    meta: { filterable: 'text' },
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
    enableSorting: true,
    meta: { filterable: 'range' },
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
    '會員', '小天使', '關懷員', '關懷員共同經營',
    '傳愛領袖', '傳愛領袖共同經營',
    '關懷長', '關懷長共同經營',
    '體系長', '體系長共同經營',
  ], 120),

  // ── 聯絡資訊 ──────────────────────────────────────────────
  editable('phone', '手機', 120, { filterable: 'text' }),
  editable('line_id', 'LINE ID', 120, { filterable: 'text' }),

  // ── 組織脈絡 ──────────────────────────────────────────────
  editable('introducer', '介紹人', 120, { filterable: 'text' }),
  editable('relation', '關係人', 100, { filterable: 'text' }),
  editable('business_chain', '業務脈', 80, { filterable: 'text' }),
  editable('counselor', '關懷員', 120, { filterable: 'text' }),
  editable('little_angel', '小天使', 100, { filterable: 'text' }),

  // ── 心之使者 ──────────────────────────────────────────────
  ch.accessor('spirit_ambassador_join_date', {
    header: '心之使者加入日',
    size: 120,
    enableSorting: true,
    meta: { filterable: 'range' },
    cell: (info) => (
      <EditableCell value={info.getValue()} rowId={info.row.original.id}
        field="spirit_ambassador_join_date" type="date" />
    ),
  }),
  ch.accessor('love_giving_start_date', {
    header: '大愛付出起始日',
    size: 120,
    enableSorting: true,
    meta: { filterable: 'range' },
    cell: (info) => (
      <EditableCell value={info.getValue()} rowId={info.row.original.id}
        field="love_giving_start_date" type="date" />
    ),
  }),
  editable('spirit_ambassador_group', '心之使者組別', 100, { filterable: 'text' }),
  editable('cumulative_seniority', '累積年資', 80),

  editable('dream_interpreter', '圓夢解盤員', 100, { filterable: 'text' }),
  editable('senior_counselor', '關懷長', 120, { filterable: 'text' }),
  selectCell('region', '地區', ['北區', '中區', '南區'], 80),
  editable('guidance_chain', '關懷脈', 80, { filterable: 'text' }),
  ch.accessor('membership_expiry', {
    header: '社團會籍',
    size: 110,
    enableSorting: true,
    meta: { filterable: 'range' },
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
  editable('course_1', '一階', 100, { filterable: 'text' }),
  editable('payment_1', '一階完款/餘額', 110, { filterable: 'text' }),
  editable('parent_1', '一階家長', 100, { filterable: 'text' }),

  // ── 二階 ─────────────────────────────────────────────────
  editable('course_2', '二階', 100, { filterable: 'text' }),
  editable('payment_2', '二階完款/餘額', 110, { filterable: 'text' }),

  // ── 三階 ─────────────────────────────────────────────────
  editable('course_3', '三階', 100, { filterable: 'text' }),
  editable('payment_3', '三階完款/餘額', 110, { filterable: 'text' }),

  // ── 四階 ─────────────────────────────────────────────────
  editable('course_4', '四階', 100, { filterable: 'text' }),
  editable('payment_4', '四階完款/餘額', 110, { filterable: 'text' }),

  // ── 五階 ─────────────────────────────────────────────────
  editable('course_5', '五階', 100, { filterable: 'text' }),
  editable('payment_5', '五階完款/餘額', 110, { filterable: 'text' }),

  // ── 五運班 ────────────────────────────────────────────────
  editable('course_wuyun', '五運', 80, { filterable: 'text' }),
  editable('payment_wuyun', '五運完款/餘額', 110, { filterable: 'text' }),
  editable('wuyun_a', '五運A', 80, { filterable: 'text' }),
  editable('wuyun_b', '五運B', 80, { filterable: 'text' }),
  editable('wuyun_c', '五運C', 80, { filterable: 'text' }),
  editable('wuyun_d', '五運D', 80, { filterable: 'text' }),
  editable('wuyun_f', '五運F', 80, { filterable: 'text' }),

  // ── 特殊課程 ──────────────────────────────────────────────
  editable('life_numbers', '生命數字', 100, { filterable: 'text' }),
  editable('life_numbers_advanced', '生命數字實戰班', 110, { filterable: 'text' }),
  editable('life_transform', '生命蛻變', 100, { filterable: 'text' }),
  editable('debt_release', '生生世世告別負債貧窮', 150, { filterable: 'text' }),

  // ── 關懷長分組 ───────────────────────────────────────────────
  editable('group_leader', '所屬分組', 120, { filterable: 'text' }),

  // ── 計算欄 (唯讀) ─────────────────────────────────────────
  ch.display({
    id: 'name_with_id',
    header: '學員(含學編)',
    size: 120,
    enableSorting: false,
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

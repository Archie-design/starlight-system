import type { Student } from '@/lib/supabase/types'
import type { ColumnFilterValue, ColumnFilterMode, SortState, StudentFilters } from '@/lib/db/types'

/**
 * 表頭逐欄篩選的白名單：key 為 `Student` 欄位名，僅在
 * `components/StudentGrid/columns.tsx` 標記 `filterable` 的欄位可篩選。
 * 後端不信任前端傳來的任意 key——不在白名單內一律忽略，避免對未建索引
 * 的欄位下推查詢，見 design.md「Risks / Trade-offs」。
 *
 * 值為該欄位**允許**的 `ColumnFilterValue.type` 集合（而非單一型態）：
 * 原本標記 `filterable: 'text'` 的欄位，除了依條件篩選（type: 'text'）
 * 外，依值篩選（動態值清單勾選）沿用 `type: 'enum'` 的既有多選/包含-排除
 * 語意（values 來源改為 `getDistinctValues()` 查詢結果而非固定選項），
 * 因此 text 型欄位同時允許 'text' 與 'enum' 兩種篩選型態並存於
 * `columnFilters`（互斥使用，切換依值/依條件籤頁即等於換用哪一型態）。
 * enum 型（gender/role/region）、range 型欄位維持單一允許型態。
 *
 * 這裡刻意用一份獨立白名單（而非讀取 columns.tsx 的 meta），保持
 * `lib/` 不依賴 UI 元件模組；新增可篩選欄位時記得同步這兩處。
 */
const TEXT_FIELD_ALLOWED_TYPES: ColumnFilterValue['type'][] = ['text', 'enum']

export const COLUMN_FILTER_FIELDS: Record<string, ColumnFilterValue['type'][]> = {
  name: TEXT_FIELD_ALLOWED_TYPES,
  phone: TEXT_FIELD_ALLOWED_TYPES,
  line_id: TEXT_FIELD_ALLOWED_TYPES,
  introducer: TEXT_FIELD_ALLOWED_TYPES,
  relation: TEXT_FIELD_ALLOWED_TYPES,
  business_chain: TEXT_FIELD_ALLOWED_TYPES,
  counselor: TEXT_FIELD_ALLOWED_TYPES,
  little_angel: TEXT_FIELD_ALLOWED_TYPES,
  spirit_ambassador_group: TEXT_FIELD_ALLOWED_TYPES,
  dream_interpreter: TEXT_FIELD_ALLOWED_TYPES,
  senior_counselor: TEXT_FIELD_ALLOWED_TYPES,
  guidance_chain: TEXT_FIELD_ALLOWED_TYPES,
  group_leader: TEXT_FIELD_ALLOWED_TYPES,
  gender: ['enum'],
  role: ['enum'],
  region: ['enum'],
  birthday: ['range'],
  membership_expiry: ['range'],
  spirit_ambassador_join_date: ['range'],
  love_giving_start_date: ['range'],
  // 課程欄位（梯次代碼/完款狀態皆為自由格式字串，用包含比對／依值勾選）
  course_1: TEXT_FIELD_ALLOWED_TYPES, payment_1: TEXT_FIELD_ALLOWED_TYPES, parent_1: TEXT_FIELD_ALLOWED_TYPES,
  course_2: TEXT_FIELD_ALLOWED_TYPES, payment_2: TEXT_FIELD_ALLOWED_TYPES,
  course_3: TEXT_FIELD_ALLOWED_TYPES, payment_3: TEXT_FIELD_ALLOWED_TYPES,
  course_4: TEXT_FIELD_ALLOWED_TYPES, payment_4: TEXT_FIELD_ALLOWED_TYPES,
  course_5: TEXT_FIELD_ALLOWED_TYPES, payment_5: TEXT_FIELD_ALLOWED_TYPES,
  course_wuyun: TEXT_FIELD_ALLOWED_TYPES, payment_wuyun: TEXT_FIELD_ALLOWED_TYPES,
  wuyun_a: TEXT_FIELD_ALLOWED_TYPES, wuyun_b: TEXT_FIELD_ALLOWED_TYPES, wuyun_c: TEXT_FIELD_ALLOWED_TYPES,
  wuyun_d: TEXT_FIELD_ALLOWED_TYPES, wuyun_f: TEXT_FIELD_ALLOWED_TYPES,
  life_numbers: TEXT_FIELD_ALLOWED_TYPES, life_numbers_advanced: TEXT_FIELD_ALLOWED_TYPES,
  life_transform: TEXT_FIELD_ALLOWED_TYPES, debt_release: TEXT_FIELD_ALLOWED_TYPES,
}

/**
 * `getDistinctValues()` 共用的前置處理（P2 #27：原本兩個 repository
 * ——`supabaseRepository.ts`／`mockRepository.ts`——各自逐字重複這段邏輯，
 * 抽到這裡統一維護）：
 * 1. 欄位不在白名單內直接視為無效查詢（回傳 null，呼叫端應回傳空陣列）。
 * 2. 從目前生效的表頭篩選中排除 `field` 自身——否則已勾選的值會讓「依值
 *    篩選」面板下次開啟時，其他選項因為被自己的篩選條件濾掉而消失
 *    （見 design.md 決策 3）。
 */
export function scopeFiltersForDistinctValues(
  field: string,
  filters: StudentFilters,
): { scopedFilters: StudentFilters } | null {
  if (!(field in COLUMN_FILTER_FIELDS)) return null

  const { [field]: _omit, ...restColumnFilters } = filters.columnFilters ?? {}
  const scopedFilters: StudentFilters = { ...filters, columnFilters: restColumnFilters }
  return { scopedFilters }
}

/**
 * 表頭排序的白名單：所有對應 `Student` 原生欄位的表格欄位皆可排序，
 * 須與 `columns.tsx` 各欄位的 `enableSorting` 標記一致——僅 `ch.display()`
 * 建立的衍生計算欄（`name_with_id`、`course_summary`）不開放排序，因為
 * 它們沒有底層資料庫欄位可供 `.order()` 或比較排序。
 * `columns.tsx`（決定表頭是否顯示排序圖示）與兩個 repository（決定
 * `.order()`/JS 排序是否真的套用）都從這裡讀取，避免兩邊各自維護
 * 一份清單而漂移（曾發生：欄位顯示排序圖示，但後端白名單沒有該欄位，
 * 點擊排序圖示後資料順序沒有任何變化）。
 *
 * 這裡的每個欄位都是 `students` 表的實際資料庫欄位，PostgREST 可直接
 * 對其 `.order()` 下推排序，不需要退化成全量載入 + JS 排序。
 */
export const SORTABLE_FIELDS = new Set<string>([
  'id', 'name', 'gender', 'role', 'phone', 'line_id',
  'introducer', 'relation', 'business_chain', 'counselor', 'little_angel',
  'birthday', 'dream_interpreter', 'senior_counselor', 'region', 'guidance_chain',
  'membership_expiry',
  'course_1', 'payment_1', 'parent_1',
  'course_2', 'payment_2',
  'course_3', 'payment_3',
  'course_4', 'payment_4',
  'course_5', 'payment_5',
  'course_wuyun', 'payment_wuyun',
  'wuyun_a', 'wuyun_b', 'wuyun_c', 'wuyun_d', 'wuyun_f',
  'life_numbers', 'life_numbers_advanced', 'life_transform', 'debt_release',
  'group_leader',
  'spirit_ambassador_join_date', 'love_giving_start_date',
  'spirit_ambassador_group', 'cumulative_seniority',
])

/**
 * 將舊格式的 text 篩選（僅有 `mode`、沒有 `operator`，來自本次變更之前
 * 儲存的 URL／狀態）轉換成新格式（`operator`）的等效篩選。新資料一律
 * 帶 `operator`，此函式只在讀取到舊資料時觸發一次性轉換，見 design.md
 * Migration Plan。
 */
export function normalizeColumnFilterValue(value: ColumnFilterValue): ColumnFilterValue {
  if (value.type === 'text' && !('operator' in value && value.operator)) {
    const legacyMode = (value as { mode?: ColumnFilterMode }).mode
    return { type: 'text', operator: legacyMode === 'exclude' ? 'not_contains' : 'contains', value: value.value }
  }
  return value
}

/** 只保留白名單內、型態相符的欄位篩選，過濾掉未知欄位或不在該欄位允許型態集合內的 key；並套用舊格式轉換 */
export function sanitizeColumnFilters(
  columnFilters: Record<string, ColumnFilterValue> | undefined | null
): Record<string, ColumnFilterValue> {
  if (!columnFilters) return {}
  const result: Record<string, ColumnFilterValue> = {}
  for (const [field, rawValue] of Object.entries(columnFilters)) {
    if (!COLUMN_FILTER_FIELDS[field]?.includes(rawValue.type)) continue
    result[field] = normalizeColumnFilterValue(rawValue)
  }
  return result
}

/** 單一欄位、單一條件是否命中 */
function matchesOne(s: Student, field: string, value: ColumnFilterValue): boolean {
  const raw = (s as unknown as Record<string, unknown>)[field]

  if (value.type === 'text') {
    const text = typeof raw === 'string' ? raw : ''
    const hasValue = typeof raw === 'string' && raw !== ''
    switch (value.operator) {
      case 'is_empty':     return !hasValue
      case 'is_not_empty': return hasValue
      case 'contains':     return !value.value || text.includes(value.value)
      case 'not_contains': return !value.value || !text.includes(value.value)
      case 'equals':       return !value.value || text === value.value
      case 'starts_with':  return !value.value || text.startsWith(value.value)
      case 'ends_with':    return !value.value || text.endsWith(value.value)
      default:              return true
    }
  }

  if (value.type === 'enum') {
    const hasValue = typeof raw === 'string' && raw !== ''
    // isEmpty: true = 篩「為空」、false = 篩「不為空」、undefined = 不使用此模式
    if (value.isEmpty !== undefined) return value.isEmpty ? !hasValue : hasValue
    if (value.values.length === 0) return true
    const matches = hasValue && value.values.includes(raw as string)
    // exclude：欄位值「不在」勾選清單內才顯示（含空值/null，因為 null 本來就不在清單裡）
    return value.mode === 'exclude' ? !matches : matches
  }

  if (value.type === 'range') {
    if (!value.min && !value.max) return true
    const hasValue = typeof raw === 'string' && !!raw
    const withinRange = hasValue && !(value.min && raw < value.min) && !(value.max && raw > value.max)
    // exclude：欄位值「不在」該區間內才顯示（含空值/null，因為空值本來就不落在任何區間內）
    return value.mode === 'exclude' ? !withinRange : withinRange
  }

  return true
}

/**
 * 表頭逐欄篩選是否全部命中（AND 關係）。傳入前應先以
 * `sanitizeColumnFilters()` 過濾掉非白名單欄位。
 */
export function matchesColumnFilters(
  s: Student,
  columnFilters: Record<string, ColumnFilterValue> | undefined
): boolean {
  if (!columnFilters) return true
  for (const [field, value] of Object.entries(columnFilters)) {
    if (!matchesOne(s, field, value)) return false
  }
  return true
}

/**
 * 依 `sort` 對一組學員排序（JS 端排序，供 supabaseRepository 的全量後處理
 * 路徑與 mockRepository 共用；SQL 可下推排序的路徑改用 `.order()`）。
 * `sort.field` 不在 `SORTABLE_FIELDS` 白名單內時原樣返回，不排序。
 * null 值一律排到最後（不論遞增/遞減）。
 *
 * 曾經在 supabaseRepository.ts 與 mockRepository.ts 各自維護一份逐字相同
 * 的實作，兩處分別調整容易漂移出不一致行為，故收斂成單一共用函式。
 */
export function applySort(rows: Student[], sort?: SortState | null): Student[] {
  if (!sort || !SORTABLE_FIELDS.has(sort.field)) return rows
  const { field, direction } = sort
  const sorted = [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[field]
    const bv = (b as unknown as Record<string, unknown>)[field]
    if (av == null && bv == null) return 0
    if (av == null) return 1  // null 值排最後
    if (bv == null) return -1
    if (av < bv) return -1
    if (av > bv) return 1
    return 0
  })
  if (direction === 'desc') sorted.reverse()
  return sorted
}

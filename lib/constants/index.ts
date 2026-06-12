/**
 * 集中管理的常量定義
 * 所有組件應從此模塊導入常量，避免重複定義
 */

// ── 地區 ──────────────────────────────────────────────────────────────
export const REGIONS = ['北區', '中區', '南區'] as const

// ── 角色 ──────────────────────────────────────────────────────────────
export const ROLES = [
  '會員',
  '小天使',
  '關懷員',
  '關懷員共同經營',
  '傳愛領袖',
  '傳愛領袖共同經營',
  '關懷長',
  '關懷長共同經營',
  '體系長',
  '體系長共同經營',
] as const

export type Role = typeof ROLES[number]

// ── 角色顏色 ──────────────────────────────────────────────────────────
export const ROLE_COLORS: Record<Role | string, string> = {
  '體系長': 'bg-purple-100 text-purple-700',
  '體系長共同經營': 'bg-purple-100 text-purple-700',
  '關懷長': 'bg-blue-100 text-blue-700',
  '關懷長共同經營': 'bg-blue-100 text-blue-700',
  '傳愛領袖': 'bg-cyan-100 text-cyan-700',
  '傳愛領袖共同經營': 'bg-cyan-100 text-cyan-700',
  '關懷員': 'bg-emerald-100 text-emerald-700',
  '關懷員共同經營': 'bg-emerald-100 text-emerald-700',
  '小天使': 'bg-yellow-100 text-yellow-700',
  '會員': 'bg-slate-100 text-slate-500',
}

// ── 維護類別 ──────────────────────────────────────────────────────────
export const MAINTENANCE_CATEGORIES = [
  { id: 'MISSING_GROUP', label: '未分配組別' },
  { id: 'MISSING_COUNSELOR', label: '關懷長空白' },
  { id: 'MISSING_CHAIN', label: '關懷體系空白' },
] as const

export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number]['id']

// ── 課程標籤 ──────────────────────────────────────────────────────────
export const COURSE_LABELS = [
  { key: 'course_1', label: '一階' },
  { key: 'course_2', label: '二階' },
  { key: 'course_3', label: '三階' },
  { key: 'course_4', label: '四階' },
  { key: 'course_5', label: '五階' },
  { key: 'course_wuyun', label: '五運' },
  { key: 'life_numbers', label: '生命數字' },
  { key: 'life_numbers_advanced', label: '生命數字實戰' },
  { key: 'life_transform', label: '生命蛻變' },
  { key: 'debt_release', label: '告別負債' },
] as const

// ── 欄位可見性分組（來自 StudentGrid/Toolbar.tsx 規範版本）
export const COLUMN_GROUPS = [
  {
    label: '基本資訊',
    cols: [
      { id: 'gender', label: '性別' },
      { id: 'birthday', label: '生日' },
      { id: 'role', label: '角色' },
      { id: 'phone', label: '手機' },
      { id: 'line_id', label: 'LINE ID' },
    ],
  },
  {
    label: '組織脈絡',
    cols: [
      { id: 'introducer', label: '介紹人' },
      { id: 'relation', label: '關係人' },
      { id: 'business_chain', label: '業務脈' },
      { id: 'counselor', label: '關懷員' },
      { id: 'little_angel', label: '小天使' },
      { id: 'spirit_ambassador_join_date', label: '心之使者加入日' },
      { id: 'love_giving_start_date', label: '大愛付出起始日' },
      { id: 'spirit_ambassador_group', label: '心之使者組別' },
      { id: 'cumulative_seniority', label: '累積年資' },
      { id: 'dream_interpreter', label: '圓夢解盤員' },
      { id: 'senior_counselor', label: '關懷長' },
      { id: 'region', label: '地區' },
      { id: 'guidance_chain', label: '關懷脈' },
      { id: 'membership_expiry', label: '社團會籍' },
    ],
  },
  {
    label: '課程',
    cols: [
      { id: 'course_1', label: '一階' },
      { id: 'payment_1', label: '一階完款' },
      { id: 'parent_1', label: '一階家長' },
      { id: 'course_2', label: '二階' },
      { id: 'payment_2', label: '二階完款' },
      { id: 'course_3', label: '三階' },
      { id: 'payment_3', label: '三階完款' },
      { id: 'course_4', label: '四階' },
      { id: 'payment_4', label: '四階完款' },
      { id: 'course_5', label: '五階' },
      { id: 'payment_5', label: '五階完款' },
      { id: 'course_wuyun', label: '五運' },
      { id: 'payment_wuyun', label: '五運完款' },
      { id: 'wuyun_a', label: '五運A' },
      { id: 'wuyun_b', label: '五運B' },
      { id: 'wuyun_c', label: '五運C' },
      { id: 'wuyun_d', label: '五運D' },
      { id: 'wuyun_f', label: '五運F' },
    ],
  },
  {
    label: '特殊課程',
    cols: [
      { id: 'life_numbers', label: '生命數字' },
      { id: 'life_numbers_advanced', label: '生命數字實戰班' },
      { id: 'life_transform', label: '生命蛻變' },
      { id: 'debt_release', label: '生生世世告別負債貧窮' },
    ],
  },
  {
    label: '關懷長分組',
    cols: [
      { id: 'group_leader', label: '所屬分組' },
    ],
  },
  {
    label: '計算欄',
    cols: [
      { id: 'name_with_id', label: '學員(含學編)' },
      { id: 'course_summary', label: '上課梯次' },
    ],
  },
] as const

export type ColumnId = typeof COLUMN_GROUPS[number]['cols'][number]['id']

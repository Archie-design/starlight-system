/**
 * 一次性初始資料遷移腳本
 * 從 星光🌟超級表格總表-啟鴻.xlsx 讀取學員名單，匯入 Supabase
 *
 * 使用方式：
 * SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx supabase/seed/migrate.ts
 */
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import type { StudentInsert } from '../../lib/supabase/types'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const XLSX_PATH = process.env.XLSX_PATH ||
  path.join(__dirname, '../../..', 'reference', '星光🌟超級表格總表-啟鴻.xlsx')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('請設定環境變數 SUPABASE_URL 和 SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const SHEETS_CONFIG = [
  { name: '學員名單', system: '星光' as const },
  { name: '學員名單(太陽)', system: '太陽' as const },
]

// 欄位對照 (學員名單 sheet 的欄位位置)
function parseStudentRow(
  row: ExcelJS.Row,
  system: '星光' | '太陽'
): StudentInsert | null {
  const get = (col: number): string | number | Date | null => {
    const cell = row.getCell(col)
    return (cell.value as string | number | Date | null) ?? null
  }

  const nameRaw = get(1)
  if (!nameRaw) return null

  const nameStr = String(nameRaw).trim()
  const match = nameStr.match(/^(\d+)_(.+)$/)
  if (!match) return null

  const id = parseInt(match[1], 10)
  const name = match[2]
  if (!id || !name) return null

  // 社團會籍日期
  const membershipRaw = get(15)
  let membershipExpiry: string | null = null
  if (membershipRaw instanceof Date) {
    membershipExpiry = membershipRaw.toISOString().split('T')[0]
  } else if (membershipRaw) {
    try {
      const d = new Date(String(membershipRaw).replace(/\//g, '-'))
      if (!isNaN(d.getTime())) membershipExpiry = d.toISOString().split('T')[0]
    } catch { /* ignore */ }
  }

  const str = (col: number): string | null => {
    const v = get(col)
    return v != null && v !== '' ? String(v).trim() : null
  }

  return {
    id,
    name,
    gender: str(2),
    birthday: null,
    role: str(3),
    sheet_system: system,
    phone: str(4),
    line_id: str(5),
    introducer: str(6),
    relation: str(7),
    business_chain: str(8),
    counselor: str(9),
    little_angel: str(10),
    dream_interpreter: str(11),
    senior_counselor: str(12),
    region: str(13),
    guidance_chain: str(14),
    membership_expiry: membershipExpiry,
    course_1: str(16),
    payment_1: str(17),
    parent_1: str(18),
    course_2: str(19),
    payment_2: str(20),
    course_3: str(21),
    payment_3: str(22),
    course_4: str(23),
    payment_4: str(24),
    course_5: str(25),
    payment_5: str(26),
    course_wuyun: str(27),
    payment_wuyun: str(28),
    wuyun_a: str(29),
    wuyun_b: str(30),
    wuyun_c: str(31),
    wuyun_d: str(32),
    wuyun_f: str(33),
    life_numbers: str(35),
    life_numbers_advanced: str(36),
    life_transform: str(37),
    debt_release: str(38),
    spirit_ambassador_join_date: null,
    love_giving_start_date: null,
    spirit_ambassador_group: null,
    cumulative_seniority: null,
    last_synced_at: null,
    system_id: null,
  }
}

async function migrate() {
  console.log(`\n📂 讀取檔案: ${XLSX_PATH}`)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const allStudents: StudentInsert[] = []

  for (const { name, system } of SHEETS_CONFIG) {
    const ws = workbook.getWorksheet(name)
    if (!ws) {
      console.warn(`⚠️  找不到工作表: ${name}`)
      continue
    }

    let count = 0
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // 跳過標題
      const student = parseStudentRow(row, system)
      if (student) {
        allStudents.push(student)
        count++
      }
    })
    console.log(`✅ ${name} (${system}): ${count} 筆`)
  }

  console.log(`\n📊 合計: ${allStudents.length} 筆學員資料`)
  console.log('⬆️  開始上傳至 Supabase...')

  // 批次 upsert (每批 100 筆)
  const BATCH_SIZE = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < allStudents.length; i += BATCH_SIZE) {
    const batch = allStudents.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('students')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`❌ 批次 ${i / BATCH_SIZE + 1} 錯誤:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\r進度: ${inserted}/${allStudents.length}`)
    }
  }

  console.log(`\n\n✅ 完成！成功: ${inserted} 筆，失敗: ${errors} 筆`)
}

migrate().catch(console.error)

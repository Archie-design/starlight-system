import ExcelJS from 'exceljs'
import type { Student } from '@/lib/supabase/types'

const HEADERS = [
  '學員ID', '姓名', '性別', '角色', '手機', 'LINE ID',
  '介紹人', '關係人', '業務脈', '輔導員', '小天使', '圓夢解盤員', '輔導長',
  '地區', '輔導脈', '社團會籍',
  '一階', '一階完款/餘額', '一階家長',
  '二階', '二階完款/餘額',
  '三階', '三階完款/餘額',
  '四階', '四階完款/餘額',
  '五階', '五階完款/餘額',
  '五運', '五運完款/餘額',
  '五運A', '五運B', '五運C', '五運D', '五運F',
  '生命數字', '生命數字實戰班', '生命蛻變', '生生世世告別負債貧窮',
]

function studentToRow(s: Student): (string | number | null)[] {
  return [
    s.id, s.name, s.gender, s.role, s.phone, s.line_id,
    s.introducer, s.relation, s.business_chain, s.counselor,
    s.little_angel, s.dream_interpreter, s.senior_counselor,
    s.region, s.guidance_chain, s.membership_expiry,
    s.course_1, s.payment_1, s.parent_1,
    s.course_2, s.payment_2,
    s.course_3, s.payment_3,
    s.course_4, s.payment_4,
    s.course_5, s.payment_5,
    s.course_wuyun, s.payment_wuyun,
    s.wuyun_a, s.wuyun_b, s.wuyun_c, s.wuyun_d, s.wuyun_f,
    s.life_numbers, s.life_numbers_advanced, s.life_transform, s.debt_release,
  ]
}

export async function buildStudentsXlsx(students: Student[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '星光超級表格系統'
  workbook.created = new Date()

  const ws = workbook.addWorksheet(sheetName)

  // 標題列
  ws.addRow(HEADERS)
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  }
  headerRow.alignment = { horizontal: 'center' }

  // 凍結標題列
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // 設定欄寬
  ws.columns = HEADERS.map((h) => ({
    header: h,
    width: Math.max(h.length * 1.8, 10),
  }))

  // 資料列
  for (const student of students) {
    ws.addRow(studentToRow(student))
  }

  // 隔行底色
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    if (rowNumber % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      }
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

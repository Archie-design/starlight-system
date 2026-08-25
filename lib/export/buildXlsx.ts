import ExcelJS from 'exceljs'
import { PassThrough } from 'node:stream'
import type { Student } from '@/lib/supabase/types'
import { APP_NAME } from '@/lib/config'

const HEADERS = [
  '學員ID', '姓名', '性別', '角色', '手機', 'LINE ID',
  '介紹人', '關係人', '業務脈', '關懷員', '小天使', '圓夢解盤員', '關懷長',
  '地區', '關懷脈', '社團會籍',
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

/**
 * 一次性建構整份 workbook 在記憶體中（原始實作，小量資料/測試用）。
 * 大量資料請改用下方 `streamStudentsXlsx()`（P1 #18）。
 */
export async function buildStudentsXlsx(students: Student[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = APP_NAME
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

/**
 * Streaming 版本（P1 #18）：用 `ExcelJS.stream.xlsx.WorkbookWriter` 邊寫邊吐出
 * bytes，呼叫端可用 async generator 分頁提供資料（例如逐頁查 DB），不需要
 * 先把全部學員資料在記憶體中集成一個陣列。列數多時記憶體佔用大幅降低，
 * 也不受單一 `writeBuffer()` 產生超大 Buffer 的限制。
 *
 * 隔行底色在 streaming writer 下無法用 `ws.eachRow()` 事後統一套用（尚未
 * flush 的列讀不到），改為逐列產生時直接判斷 rowNumber 套用，行為與原本
 * 一次性版本一致。
 *
 * @param studentPages async generator，每次 yield 一頁 Student[]（呼叫端控制分頁大小）
 * @returns Node.js Readable，可直接接到 Response 的 body（見 app/api/export/route.ts）
 */
export function streamStudentsXlsx(
  studentPages: AsyncIterable<Student[]>,
  sheetName: string,
): PassThrough {
  const passthrough = new PassThrough()

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passthrough, useStyles: true })
  workbook.creator = APP_NAME
  workbook.created = new Date()

  // WorksheetWriter 的 `views` 是唯讀 getter，須在 addWorksheet() 建立時
  // 透過 options 傳入，事後賦值會丟出 TypeError（與一次性 Workbook API 不同）。
  const ws = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = HEADERS.map((h) => ({
    header: h,
    width: Math.max(h.length * 1.8, 10),
  }))

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
  headerRow.alignment = { horizontal: 'center' }
  headerRow.commit()

  ;(async () => {
    try {
      let rowNumber = 1
      for await (const page of studentPages) {
        for (const student of page) {
          rowNumber++
          const row = ws.addRow(studentToRow(student))
          if (rowNumber % 2 === 0) {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
          }
          row.commit()
        }
      }
      ws.commit()
      await workbook.commit()
    } catch (err) {
      passthrough.destroy(err instanceof Error ? err : new Error(String(err)))
    }
  })()

  return passthrough
}

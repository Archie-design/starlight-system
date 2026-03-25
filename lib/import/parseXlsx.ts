import ExcelJS from 'exceljs'
import type { StudentInsert } from '@/lib/supabase/types'
import { transformSourceRow } from './transform'

/**
 * 解析來源 xlsx Buffer，返回轉換後的學員資料
 * 適用於 學員關懷傘下學員報課狀況.xlsx
 */
export async function parseSourceXlsx(buffer: ArrayBuffer): Promise<{
  rows: StudentInsert[]
  skipped: number
  totalSourceRows: number
}> {
  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)

  // 取第一個 sheet
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('找不到工作表')

  const rows: StudentInsert[] = []
  let skipped = 0
  let totalSourceRows = 0

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // 跳過標題列

    totalSourceRows++
    const values = row.values as (string | number | Date | null | undefined)[]
    // ExcelJS row.values 是 1-indexed，index 0 為 undefined
    // slice(1) 轉為 0-indexed，transform 使用 get(col) = row[col-1] 也是 0-indexed
    const rowData = values.slice(1) as (string | number | Date | null | undefined)[]

    const student = transformSourceRow(rowData)
    if (student) {
      rows.push(student)
    } else {
      skipped++
    }
  })

  return { rows, skipped, totalSourceRows }
}

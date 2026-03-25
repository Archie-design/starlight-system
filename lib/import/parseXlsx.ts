import ExcelJS from 'exceljs'
import type { StudentInsert } from '@/lib/supabase/types'
import { transformSourceRow, HEADER_TO_COL_KEY, DEFAULT_COL, type ColMap } from './transform'

/**
 * 解析來源 xlsx Buffer，返回轉換後的學員資料
 * 具備動態標題偵測功能
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

  // 動態欄位對應，預設使用 DEFAULT_COL
  const colMap: ColMap = { ...DEFAULT_COL }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // 解析標題列，建立動態索引映射
      // ExcelJS row.values[1] 是第一欄
      const values = row.values as (string | null | undefined)[]
      values.forEach((value, index) => {
        if (!value) return
        const headerName = String(value).trim()
        const key = HEADER_TO_COL_KEY[headerName]
        if (key) {
          colMap[key] = index
        }
      })
      return
    }

    totalSourceRows++
    const values = row.values as (string | number | Date | null | undefined)[]
    // ExcelJS row.values 是 1-indexed，index 0 為 undefined
    // slice(1) 轉為 0-indexed，transform 使用 get(col) = row[col-1]
    const rowData = values.slice(1) as (string | number | Date | null | undefined)[]

    const student = transformSourceRow(rowData, colMap)
    if (student) {
      rows.push(student)
    } else {
      skipped++
    }
  })

  return { rows, skipped, totalSourceRows }
}

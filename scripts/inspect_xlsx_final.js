const ExcelJS = require('exceljs');
const path = require('path');

async function checkExcel() {
  const filePath = path.join(process.cwd(), 'reference', '學員資料庫 20260325.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  const row1 = worksheet.getRow(1);
  console.log('Headers:', JSON.stringify(row1.values.slice(1)));
  
  const row2 = worksheet.getRow(2);
  console.log('Row 2:', JSON.stringify(row2.values.slice(1)));
}

checkExcel().catch(console.error);

const ExcelJS = require('exceljs');
const path = require('path');

async function checkExcel() {
  const filePath = path.join(process.cwd(), 'reference', '學員資料庫 20260325.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  console.log(`Sheet: ${worksheet.name}`);
  console.log(`Row count: ${worksheet.actualRowCount}`);

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) {
      console.log('Header:', JSON.stringify(row.values.slice(1)));
    } else if (rowNumber <= 3) {
      console.log(`Row ${rowNumber}:`, JSON.stringify(row.values.slice(1)));
    }
  });

}

checkExcel().catch(console.error);

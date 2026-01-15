const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const filePath = path.join(__dirname, '../../LUC_STUDENT_DATA BASE _2025.xlsx');
const workbook = XLSX.readFile(filePath);

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('=== EXCEL FILE ANALYSIS ===\n');
console.log('Sheet Name:', sheetName);
console.log('Total Rows (including header):', data.length);
console.log('\n=== COLUMN HEADERS (Row 1) ===\n');

const headers = data[0];
headers.forEach((header, index) => {
    console.log(`Column ${index + 1}: "${header}"`);
});

console.log('\n=== SAMPLE DATA (First 3 rows) ===\n');

for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
    console.log(`--- Row ${i} ---`);
    data[i].forEach((value, index) => {
        console.log(`  ${headers[index]}: ${value}`);
    });
    console.log('');
}

console.log('=== END OF ANALYSIS ===');

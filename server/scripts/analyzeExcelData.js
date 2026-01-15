const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const filePath = path.join(__dirname, '../../LUC_STUDENT_DATA BASE _2025.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('=== COMPREHENSIVE DATA ANALYSIS ===\n');
console.log(`Total Records: ${data.length}\n`);

// Analyze each column
const columns = [
    'SNO', 'MONTH', 'STUDENT NAME', 'GENDER', 'PROGRAM', 'UNIVERSITY',
    'COURSE FEE', 'SOURCE', 'CAMPAIGN NAME', 'Enquiry Date', 'CLOSING DATE',
    'CONVERSION TIME', 'CONSULTANT', 'TEAM LEADER', 'RESIDENCE', 'AREA',
    'NATIONALITY', 'COMPANY NAME', 'DESIGNATION', 'EXPERIENCE',
    'INDUSTRY TYPE', 'DEPT TYPE'
];

columns.forEach(col => {
    const values = data.map(row => row[col]).filter(v => v !== undefined && v !== null && v !== '');
    const uniqueValues = [...new Set(values.map(v => String(v).trim().toUpperCase()))];
    
    console.log(`\n=== ${col} ===`);
    console.log(`  Non-empty values: ${values.length}/${data.length}`);
    console.log(`  Unique values: ${uniqueValues.length}`);
    
    // For certain columns, show all unique values
    if (['GENDER', 'UNIVERSITY', 'SOURCE', 'MONTH'].includes(col)) {
        console.log(`  Values: ${uniqueValues.sort().join(', ')}`);
    }
    
    // For PROGRAM, show count by university
    if (col === 'PROGRAM') {
        const programsByUniv = {};
        data.forEach(row => {
            const univ = row['UNIVERSITY'];
            const prog = row['PROGRAM'];
            if (univ && prog) {
                if (!programsByUniv[univ]) programsByUniv[univ] = new Set();
                programsByUniv[univ].add(prog);
            }
        });
        console.log('  Programs by University:');
        Object.keys(programsByUniv).sort().forEach(univ => {
            console.log(`    ${univ}: ${[...programsByUniv[univ]].sort().join(', ')}`);
        });
    }
    
    // For numeric columns, show range
    if (['COURSE FEE', 'EXPERIENCE', 'CONVERSION TIME'].includes(col)) {
        const numValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        if (numValues.length > 0) {
            console.log(`  Min: ${Math.min(...numValues)}`);
            console.log(`  Max: ${Math.max(...numValues)}`);
            console.log(`  Avg: ${(numValues.reduce((a, b) => a + b, 0) / numValues.length).toFixed(2)}`);
        }
    }
    
    // For text columns with many values, show sample
    if (['NATIONALITY', 'AREA', 'RESIDENCE', 'INDUSTRY TYPE', 'DEPT TYPE'].includes(col) && uniqueValues.length > 10) {
        console.log(`  Sample (first 15): ${uniqueValues.slice(0, 15).join(', ')}`);
    }
});

// Check for any additional columns we might have missed
const allColumns = new Set();
data.forEach(row => {
    Object.keys(row).forEach(key => allColumns.add(key));
});

console.log('\n\n=== ALL COLUMNS IN EXCEL ===');
console.log([...allColumns].join(', '));

// Check for columns we might not be capturing
const expectedColumns = new Set(columns);
const extraColumns = [...allColumns].filter(c => !expectedColumns.has(c));
if (extraColumns.length > 0) {
    console.log('\n⚠️  EXTRA COLUMNS NOT IN OUR SCHEMA:');
    extraColumns.forEach(c => console.log(`   - ${c}`));
}

console.log('\n=== END OF ANALYSIS ===');

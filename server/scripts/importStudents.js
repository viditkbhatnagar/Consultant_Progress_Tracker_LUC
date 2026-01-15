const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const connectDB = require('../config/db');
const Student = require('../models/Student');
const Consultant = require('../models/Consultant');
const User = require('../models/User');

// University name mapping
const universityMap = {
    'SSM': 'Swiss School of Management (SSM)',
    'KNIGHTS': 'Knights College',
    'KNIGHTS COLLEGE': 'Knights College',
    'MUST': 'Malaysia University of Science & Technology (MUST)',
    'AGI': 'AGI – American Global Institute (Certifications)',
    'CMBS': 'CMBS',
    'OTHM': 'OTHM',
};

// Source normalization map
const sourceMap = {
    'GOOGLE ADS': 'Google Ads',
    'GOOGLE': 'Google Ads',
    'FACEBOOK': 'Facebook',
    'FB': 'Facebook',
    'TIK TOK': 'Tik Tok',
    'TIKTOK': 'Tik Tok',
    'CALL-IN': 'Call-In',
    'CALL IN': 'Call-In',
    'OLD CRM': 'Old Crm',
    'LINKEDIN': 'Linkedin',
    'WHATSAPP': 'Whatsapp',
    'ALUMNI': 'Alumni',
    'SEO': 'Seo',
    'INSTAGRAM': 'Instagram',
    'IG': 'Instagram',
    'REFERENCE': 'Reference',
    'REF': 'Reference',
};

// Convert Excel date serial number to JavaScript Date
function excelDateToJS(serial) {
    if (!serial) return null;
    
    // If it's already a string date like "1/28/2025"
    if (typeof serial === 'string') {
        const parsed = new Date(serial);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
        return null;
    }
    
    // Excel date serial number conversion
    // Excel's epoch is December 30, 1899
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
}

// Normalize gender
function normalizeGender(gender) {
    if (!gender) return null;
    const g = gender.toString().toUpperCase().trim();
    if (g === 'MALE' || g === 'M') return 'Male';
    if (g === 'FEMALE' || g === 'F') return 'Female';
    return null;
}

// Normalize source
function normalizeSource(source) {
    if (!source) return null;
    const s = source.toString().toUpperCase().trim();
    return sourceMap[s] || null;
}

// Normalize university
function normalizeUniversity(university) {
    if (!university) return null;
    const u = university.toString().toUpperCase().trim();
    return universityMap[u] || null;
}

const importStudents = async () => {
    try {
        await connectDB();
        console.log('🔄 Starting Student Import from Excel...\n');

        // Load existing consultants and team leads from database
        const consultants = await Consultant.find({}).lean();
        const teamLeads = await User.find({ role: 'team_lead' }).lean();
        const adminUser = await User.findOne({ role: 'admin' }).lean();

        if (!adminUser) {
            console.error('❌ No admin user found. Please ensure an admin exists.');
            process.exit(1);
        }

        console.log(`Found ${consultants.length} consultants in database`);
        console.log(`Found ${teamLeads.length} team leads in database`);
        console.log('');

        // Create lookup maps (case-insensitive)
        const consultantMap = new Map();
        consultants.forEach(c => {
            consultantMap.set(c.name.toLowerCase(), c);
        });

        const teamLeadMap = new Map();
        teamLeads.forEach(tl => {
            teamLeadMap.set(tl.name.toLowerCase(), tl);
        });

        // Read Excel file
        const filePath = path.join(__dirname, '../../LUC_STUDENT_DATA BASE _2025.xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        console.log(`📊 Found ${rawData.length} records in Excel file\n`);

        // Track statistics
        let imported = 0;
        let skipped = 0;
        const errors = [];
        const missingConsultants = new Set();
        const missingTeamLeads = new Set();

        // Get current max SNO per team
        const snoCounters = new Map();

        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            
            try {
                // Extract and normalize data
                const studentName = row['STUDENT NAME']?.toString().trim();
                const gender = normalizeGender(row['GENDER']);
                const program = row['PROGRAM']?.toString().trim();
                const university = normalizeUniversity(row['UNIVERSITY']);
                const courseFee = parseFloat(row['COURSE FEE']) || 0;
                const source = normalizeSource(row['SOURCE']);
                const campaignName = row['CAMPAIGN NAME']?.toString().trim() || 'N/A';
                const enquiryDate = excelDateToJS(row['Enquiry Date']);
                const closingDate = excelDateToJS(row['CLOSING DATE']);
                const consultantName = row['CONSULTANT']?.toString().trim();
                const teamLeaderName = row['TEAM LEADER']?.toString().trim();
                const residence = row['RESIDENCE']?.toString().trim() || 'N/A';
                const area = row['AREA']?.toString().trim() || 'N/A';
                const nationality = row['NATIONALITY']?.toString().trim() || 'N/A';
                const companyName = row['COMPANY NAME']?.toString().trim() || 'N/A';
                const designation = row['DESIGNATION']?.toString().trim() || 'N/A';
                const experience = parseInt(row['EXPERIENCE']) || 0;
                const industryType = row['INDUSTRY TYPE']?.toString().trim() || 'N/A';
                const deptType = row['DEPT TYPE']?.toString().trim() || 'N/A';

                // Validate required fields
                if (!studentName) {
                    errors.push({ row: i + 2, error: 'Missing student name' });
                    skipped++;
                    continue;
                }

                if (!gender) {
                    errors.push({ row: i + 2, error: `Invalid gender: ${row['GENDER']}`, student: studentName });
                    skipped++;
                    continue;
                }

                if (!university) {
                    errors.push({ row: i + 2, error: `Invalid university: ${row['UNIVERSITY']}`, student: studentName });
                    skipped++;
                    continue;
                }

                if (!source) {
                    errors.push({ row: i + 2, error: `Invalid source: ${row['SOURCE']}`, student: studentName });
                    skipped++;
                    continue;
                }

                if (!enquiryDate || !closingDate) {
                    errors.push({ row: i + 2, error: 'Missing or invalid dates', student: studentName });
                    skipped++;
                    continue;
                }

                // Look up consultant
                const consultant = consultantMap.get(consultantName?.toLowerCase());
                if (!consultant) {
                    missingConsultants.add(consultantName);
                }

                // Look up team lead
                let teamLead = teamLeadMap.get(teamLeaderName?.toLowerCase());
                
                // If consultant exists, use their team lead
                if (consultant && consultant.teamLead) {
                    const tlFromConsultant = teamLeads.find(tl => tl._id.toString() === consultant.teamLead.toString());
                    if (tlFromConsultant) {
                        teamLead = tlFromConsultant;
                    }
                }

                if (!teamLead) {
                    missingTeamLeads.add(teamLeaderName);
                    // Try to find any team lead as fallback
                    teamLead = teamLeads[0];
                }

                if (!teamLead) {
                    errors.push({ row: i + 2, error: 'No team lead found', student: studentName });
                    skipped++;
                    continue;
                }

                // Get next SNO for this team
                const teamLeadId = teamLead._id.toString();
                if (!snoCounters.has(teamLeadId)) {
                    const lastStudent = await Student.findOne({ teamLead: teamLead._id })
                        .sort({ sno: -1 })
                        .select('sno');
                    snoCounters.set(teamLeadId, lastStudent ? lastStudent.sno : 0);
                }
                const nextSno = snoCounters.get(teamLeadId) + 1;
                snoCounters.set(teamLeadId, nextSno);

                // Create student record
                const studentData = {
                    sno: nextSno,
                    month: '', // Will be set by pre-validate hook
                    studentName,
                    gender,
                    program,
                    university,
                    courseFee,
                    source,
                    campaignName,
                    enquiryDate,
                    closingDate,
                    conversionTime: 0, // Will be calculated by pre-validate hook
                    consultantName: consultantName || 'Unknown',
                    consultant: consultant?._id,
                    teamLeadName: teamLead.name,
                    teamLead: teamLead._id,
                    teamName: teamLead.teamName || teamLead.name,
                    residence,
                    area,
                    nationality,
                    companyName,
                    designation,
                    experience,
                    industryType,
                    deptType,
                    createdBy: adminUser._id,
                };

                await Student.create(studentData);
                imported++;

                // Progress indicator
                if (imported % 100 === 0) {
                    console.log(`✅ Imported ${imported} students...`);
                }

            } catch (err) {
                errors.push({ row: i + 2, error: err.message, student: row['STUDENT NAME'] });
                skipped++;
            }
        }

        console.log('\n========================================');
        console.log('📊 IMPORT SUMMARY');
        console.log('========================================');
        console.log(`✅ Successfully imported: ${imported} students`);
        console.log(`⚠️  Skipped: ${skipped} records`);
        
        if (missingConsultants.size > 0) {
            console.log(`\n⚠️  Consultants not found in database (${missingConsultants.size}):`);
            [...missingConsultants].forEach(c => console.log(`   - ${c}`));
        }

        if (missingTeamLeads.size > 0) {
            console.log(`\n⚠️  Team leads not found in database (${missingTeamLeads.size}):`);
            [...missingTeamLeads].forEach(tl => console.log(`   - ${tl}`));
        }

        if (errors.length > 0 && errors.length <= 20) {
            console.log('\n❌ Errors:');
            errors.forEach(e => console.log(`   Row ${e.row}: ${e.error} ${e.student ? `(${e.student})` : ''}`));
        } else if (errors.length > 20) {
            console.log(`\n❌ ${errors.length} errors occurred (showing first 20):`);
            errors.slice(0, 20).forEach(e => console.log(`   Row ${e.row}: ${e.error} ${e.student ? `(${e.student})` : ''}`));
        }

        console.log('\n========================================');
        console.log('🎉 Import completed!');
        console.log('========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
};

importStudents();

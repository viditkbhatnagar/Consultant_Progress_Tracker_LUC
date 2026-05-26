// One-shot seed: walks the LUC team sheets in DASHBOARD_changes.xlsx and
// upserts a TeamMonthlyEntry row per (consultant, year, month). Idempotent
// — safe to re-run. After this completes, every future edit happens
// through the in-app Team Detail / Monthly Targets pages.
//
// Usage:
//   node server/scripts/seedTeamEntriesFromExcel.js                  # default year + path
//   YEAR=2025 node server/scripts/seedTeamEntriesFromExcel.js
//   EXCEL_PATH=/some/file.xlsx node server/scripts/seedTeamEntriesFromExcel.js
//   DRY_RUN=1 node server/scripts/seedTeamEntriesFromExcel.js        # report only, no writes
//
// The script never deletes existing rows. Re-running with the same input
// produces the same DB state (last writer wins via upsert).

const path = require('path');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Consultant = require('../models/Consultant');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');

const DEFAULT_EXCEL_PATH = '/Users/viditkbhatnagar/Downloads/DASHBOARD_changes.xlsx';
const EXCEL_PATH = process.env.EXCEL_PATH || DEFAULT_EXCEL_PATH;
const YEAR = parseInt(process.env.YEAR, 10) || 2025;
const DRY_RUN = process.env.DRY_RUN === '1';

// Sheet → team-lead User name in the DB.
const TEAM_SHEETS = {
    'Team Tony': 'Tony',
    'Team Shaik': 'Shaik',
    'Team Shasin': 'Shasin',
    'Team Shakil': 'Shakil',
    'Team Anousha': 'Anousha',
    'Team Jamshad': 'Jamshad',
    'Team Manoj': 'Manoj',
    'Team Bahrain': 'Bahrain',
    'Team Arfath': 'Arfath',
};

// Excel column letter → TeamMonthlyEntry field name. D (% Rev) and E
// (Total Admissions) are skipped — both are derived in the aggregator
// from the program-bucket counts, so we don't store them.
const COL_TO_FIELD = {
    B: 'monthlyTarget',
    C: 'achievedRevenue',
    F: 'agi',
    G: 'agi_standalone',
    H: 'ssm_mba',
    I: 'ssm_bba',
    J: 'othm_mba',
    K: 'ioscm_mba',
    L: 'knights_mba',
    M: 'knights_bba',
    N: 'must',
    O: 'othm_7',
    P: 'ioscm_7',
    Q: 'othm_3',
    R: 'dba',
    S: 'othm_ext_l5',
    T: 'othm_4_5',
    U: 'othm_6',
};

const MONTH_NAMES = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function readNumber(cell) {
    if (!cell) return 0;
    const n = Number(cell.v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function cellText(cell) {
    return cell?.v == null ? '' : String(cell.v).trim();
}

// Walk a sheet and return [{month: 1..12, memberRows: [rowNumbers]}].
// Strategy: find every month-name label in column A. For each, the
// member rows are the contiguous numeric-B rows starting two rows below
// the label and ending at TEAM TOTAL / an empty row / the next month
// label. Capping the window at "row before next month label" prevents
// scanner from leaking into post-December summary sections like
// "MEMBER WISE MONTHLY REVENUE" or "CONSOLIDATED ADMISSIONS — PROGRAM
// WISE" which exist in several team sheets.
function scanMonthBlocks(sheet) {
    const labels = [];
    const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:A1');
    for (let r = range.s.r + 1; r <= range.e.r + 1; r++) {
        const upper = cellText(sheet[`A${r}`]).toUpperCase();
        const monthIdx = MONTH_NAMES.indexOf(upper);
        if (monthIdx >= 0) labels.push({ month: monthIdx + 1, row: r });
    }

    return labels.map((label, i) => {
        // Hard upper bound: row just before next label, or +11 for December
        // (8 member rows + 1 column header + 1 team total ≈ 10 rows).
        const next = i + 1 < labels.length ? labels[i + 1].row : label.row + 12;
        const memberRows = [];
        for (let rr = label.row + 2; rr < next; rr++) {
            const name = cellText(sheet[`A${rr}`]);
            if (!name) break;
            const upper = name.toUpperCase();
            if (upper === 'TEAM TOTAL') break;
            if (MONTH_NAMES.includes(upper)) break;
            // Only count the row if column B (Monthly Target) is a number.
            // Header rows like "Member" / "Month" / "Program" have text in
            // column B (or nothing), so they're filtered out here.
            const b = sheet[`B${rr}`];
            if (!b || b.t !== 'n') continue;
            memberRows.push(rr);
        }
        return { month: label.month, memberRows };
    });
}

// Names that show up in column A in post-December summary sections
// ("Member Wise Monthly Revenue", "Consolidated Admissions — Program
// Wise") which also have numeric B columns. Skip them so they don't
// pollute the unmatched-names report.
const SECTION_LABELS = new Set([
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    'month', 'program', 'grand total',
    'ytd %', 'ytd achieved', 'ytd target', 'ytd total', 'ytd gap',
    'agi', 'agi standalone',
    'ssm mba', 'ssm bba', 'othm+mba', 'ioscm+mba',
    'knights mba', 'knights bba', 'must',
    'othm-7', 'ioscm-7', 'othm-3', 'dba',
    'othm ext l5', 'othm-4,5', 'othm-6',
]);

function isFillerName(name) {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    return (
        lower === '' ||
        lower === 'team total' ||
        lower.startsWith('new member') ||
        lower === 'member' ||
        SECTION_LABELS.has(lower)
    );
}

// Explicit overrides for known Excel ↔ DB name drift. Keys are lowercase
// Excel names; values are exact DB names. Add to this map as you spot
// new mismatches in the script's "didn't match" report.
const NAME_OVERRIDES = {
    'lijja': 'Lijia',
    'aisha': 'Aysha Riswin',
    'kashish': 'Kashish seth',
    'anaswara': 'Anaswara PK',
    'swetha': 'Swetha Reddy',
    'nigel': 'NIGEL',
};

// Resolve an Excel member name to a Consultant doc on this team.
// Order:
//   1. exact lowercase trim match
//   2. first-word match  (Excel "Swetha" → DB "Swetha Reddy")
//   3. DB name startsWith Excel name (Excel "Kashish" → DB "Kashish seth")
// Returns the Consultant or null.
function matchConsultant(excelName, consultants) {
    const key = excelName.toLowerCase().trim();
    const byLower = new Map(
        consultants.map((c) => [c.name.toLowerCase().trim(), c])
    );

    // Explicit override wins
    if (NAME_OVERRIDES[key]) {
        const dbName = NAME_OVERRIDES[key].toLowerCase().trim();
        if (byLower.has(dbName)) return byLower.get(dbName);
    }

    if (byLower.has(key)) return byLower.get(key);

    const firstWord = key.split(/\s+/)[0];
    for (const c of consultants) {
        const dbFirst = c.name.toLowerCase().trim().split(/\s+/)[0];
        if (dbFirst === firstWord) return c;
    }
    for (const c of consultants) {
        if (c.name.toLowerCase().trim().startsWith(key)) return c;
    }
    return null;
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not set — check server/.env');
    }
    console.log(`reading: ${EXCEL_PATH}`);
    console.log(`year:    ${YEAR}`);
    console.log(`dryRun:  ${DRY_RUN}`);

    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`connected to MongoDB: ${mongoose.connection.name}\n`);

    const wb = xlsx.readFile(EXCEL_PATH);

    let upserted = 0;
    let skipped = 0;
    const unmatched = new Map(); // team → Set(names)

    for (const [sheetName, teamLeadName] of Object.entries(TEAM_SHEETS)) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) {
            console.warn(`  ! sheet "${sheetName}" not found, skipping team`);
            continue;
        }
        const teamLead = await User.findOne({
            role: 'team_lead',
            name: teamLeadName,
            organization: 'luc',
        }).lean();
        if (!teamLead) {
            console.warn(`  ! team lead "${teamLeadName}" not found in DB, skipping ${sheetName}`);
            continue;
        }

        const consultants = await Consultant.find({ teamLead: teamLead._id }).lean();
        console.log(`${sheetName} — lead: ${teamLeadName} (${consultants.length} consultants in DB)`);

        let teamUpserted = 0;
        let teamSkipped = 0;
        const blocks = scanMonthBlocks(sheet);

        for (const block of blocks) {
            for (const r of block.memberRows) {
                const memberName = cellText(sheet[`A${r}`]);
                if (isFillerName(memberName)) continue;

                // Skip rows where the name is the team lead themselves (they
                // appear as a member row in the Excel but typically aren't a
                // Consultant doc).
                if (memberName.toLowerCase() === teamLeadName.toLowerCase()) {
                    continue;
                }

                const consultant = matchConsultant(memberName, consultants);
                if (!consultant) {
                    if (!unmatched.has(sheetName)) unmatched.set(sheetName, new Set());
                    unmatched.get(sheetName).add(memberName);
                    teamSkipped++;
                    skipped++;
                    continue;
                }

                const doc = {
                    organization: 'luc',
                    teamLead: teamLead._id,
                    consultant: consultant._id,
                    consultantName: consultant.name,
                    year: YEAR,
                    month: block.month,
                };
                let hasNonZero = false;
                for (const [col, field] of Object.entries(COL_TO_FIELD)) {
                    const n = readNumber(sheet[`${col}${r}`]);
                    doc[field] = n;
                    if (n !== 0) hasNonZero = true;
                }

                // Skip rows that are entirely zero (placeholder rows for
                // months that haven't happened yet). Avoids polluting the
                // DB with rows the user would only see as empty anyway.
                if (!hasNonZero) continue;

                if (!DRY_RUN) {
                    await TeamMonthlyEntry.findOneAndUpdate(
                        { consultant: consultant._id, year: YEAR, month: block.month },
                        { $set: doc },
                        { upsert: true, new: false, setDefaultsOnInsert: true }
                    );
                }
                teamUpserted++;
                upserted++;
            }
        }
        console.log(`  upserted ${teamUpserted}, skipped ${teamSkipped}`);
    }

    console.log(`\n=== totals ===`);
    console.log(`upserted: ${upserted}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
    console.log(`skipped:  ${skipped}`);
    if (unmatched.size) {
        console.log('\nconsultant names in Excel that didn\'t match the DB:');
        for (const [team, names] of unmatched.entries()) {
            console.log(`  ${team}: ${[...names].sort().join(', ')}`);
        }
        console.log('\nThese rows were skipped. Either rename the consultant in the DB or in the Excel and re-run.');
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

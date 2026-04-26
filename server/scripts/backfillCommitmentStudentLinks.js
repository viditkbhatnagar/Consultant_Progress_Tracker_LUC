/**
 * Idempotent backfill of the Commitment <-> Student FK link for the LUC org.
 * Runs in three tiers:
 *
 *   Tier 1 — exact (studentName + consultantName) match, |dateGap| <= 30d.
 *            Writes Student.commitmentId AND Commitment.studentId.
 *
 *   Tier 2 — high-confidence fuzzy match within the same consultant +/- 30d.
 *            Token-containment score (max of name-A-in-name-B and reverse)
 *            >= FUZZY_THRESHOLD => auto-link. Picks the closest-by-date row
 *            when multiple students score equally.
 *
 *   Tier 3 — leftovers. Not written here; surface in the reconciliation page.
 *
 * Pass --dry-run to print counts per tier without writing.
 *
 * Usage:
 *   cd server && node scripts/backfillCommitmentStudentLinks.js --dry-run
 *   cd server && node scripts/backfillCommitmentStudentLinks.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Commitment = require('../models/Commitment');

const dryRun = process.argv.includes('--dry-run');
const SCOPE_START = new Date('2026-01-01T00:00:00.000Z');
const DATE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // ±30 days
const FUZZY_THRESHOLD = 0.6;

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const tokens = (s) => new Set(norm(s).split(' ').filter(Boolean));

const containment = (a, b) => {
    if (a.size === 0 || b.size === 0) return 0;
    let hits = 0;
    a.forEach((t) => { if (b.has(t)) hits++; });
    return hits / a.size;
};

const fuzzyScore = (nameA, nameB) => {
    const a = tokens(nameA);
    const b = tokens(nameB);
    return Math.max(containment(a, b), containment(b, a));
};

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.', dryRun ? '(DRY RUN)' : '');

    // Pull eligible candidates. We only consider rows that don't already
    // carry the FK so this is safe to re-run.
    const closedCommits = await Commitment.find({
        organization: 'luc',
        admissionClosed: true,
        commitmentDate: { $gte: SCOPE_START },
        $or: [{ studentId: null }, { studentId: { $exists: false } }],
    })
        .select('studentName consultantName teamName teamLead commitmentDate')
        .lean();

    const orphanStudents = await Student.find({
        organization: 'luc',
        closingDate: { $gte: SCOPE_START },
        $or: [{ commitmentId: null }, { commitmentId: { $exists: false } }],
    })
        .select('studentName consultantName teamName teamLead closingDate manualEntry')
        .lean();

    console.log(`Eligible closed commitments: ${closedCommits.length}`);
    console.log(`Eligible orphan students:    ${orphanStudents.length}`);

    // Index students by consultant_lower for quick lookup
    const studentsByConsultant = new Map();
    orphanStudents.forEach((s) => {
        const k = norm(s.consultantName);
        if (!studentsByConsultant.has(k)) studentsByConsultant.set(k, []);
        studentsByConsultant.get(k).push(s);
    });

    const usedStudentIds = new Set();
    const writes = []; // { commitmentId, studentId, tier, score, gap }

    // ── Tier 1: exact name + consultant + within window ──────────────
    for (const c of closedCommits) {
        const candidates = studentsByConsultant.get(norm(c.consultantName)) || [];
        const cName = norm(c.studentName);
        const tier1 = candidates.find((s) => {
            if (usedStudentIds.has(String(s._id))) return false;
            if (norm(s.studentName) !== cName) return false;
            const gap = Math.abs(new Date(s.closingDate) - new Date(c.commitmentDate));
            return gap <= DATE_WINDOW_MS;
        });
        if (tier1) {
            usedStudentIds.add(String(tier1._id));
            writes.push({
                commitmentId: c._id,
                studentId: tier1._id,
                tier: 1,
                score: 1,
                gap: Math.round((new Date(tier1.closingDate) - new Date(c.commitmentDate)) / 86400000),
            });
        }
    }

    const tier1Pairs = writes.length;
    console.log(`Tier 1 (exact match):       ${tier1Pairs}`);

    // ── Tier 2: high-confidence fuzzy within window + same consultant ─
    const remaining = closedCommits.filter(
        (c) => !writes.find((w) => String(w.commitmentId) === String(c._id))
    );
    for (const c of remaining) {
        const candidates = (studentsByConsultant.get(norm(c.consultantName)) || [])
            .filter((s) => !usedStudentIds.has(String(s._id)));
        const inWindow = candidates.filter((s) => {
            const gap = Math.abs(new Date(s.closingDate) - new Date(c.commitmentDate));
            return gap <= DATE_WINDOW_MS;
        });
        if (inWindow.length === 0) continue;

        let best = null;
        for (const s of inWindow) {
            const score = fuzzyScore(c.studentName, s.studentName);
            if (!best || score > best.score
                || (score === best.score
                    && Math.abs(new Date(s.closingDate) - new Date(c.commitmentDate))
                       < Math.abs(new Date(best.s.closingDate) - new Date(c.commitmentDate)))) {
                best = { s, score };
            }
        }
        if (best && best.score >= FUZZY_THRESHOLD) {
            usedStudentIds.add(String(best.s._id));
            writes.push({
                commitmentId: c._id,
                studentId: best.s._id,
                tier: 2,
                score: Number(best.score.toFixed(2)),
                gap: Math.round((new Date(best.s.closingDate) - new Date(c.commitmentDate)) / 86400000),
            });
        }
    }
    const tier2Pairs = writes.length - tier1Pairs;
    console.log(`Tier 2 (fuzzy auto-link):   ${tier2Pairs}`);

    const unmatchedCommits = closedCommits.length - writes.length;
    const unmatchedStudents = orphanStudents.length - writes.length;
    console.log(`Tier 3 (admin review):      commits=${unmatchedCommits}, students=${unmatchedStudents}`);

    if (dryRun) {
        // Show 5 samples per tier for spot-check
        const showSamples = (tier) => {
            const sample = writes.filter((w) => w.tier === tier).slice(0, 5);
            sample.forEach((w) => {
                const c = closedCommits.find((x) => String(x._id) === String(w.commitmentId));
                const s = orphanStudents.find((x) => String(x._id) === String(w.studentId));
                console.log(`  T${tier} [${w.score}, gap=${w.gap}d]  C:"${c?.studentName}"  ↔  S:"${s?.studentName}"  (${c?.consultantName})`);
            });
        };
        console.log('--- Sample pairs (first 5 per tier) ---');
        showSamples(1);
        showSamples(2);
        await mongoose.disconnect();
        console.log('Dry run only — no writes performed.');
        return;
    }

    // Live mode — write the FKs in both directions, in batches.
    let written = 0;
    for (const w of writes) {
        await Promise.all([
            Student.updateOne(
                { _id: w.studentId, $or: [{ commitmentId: null }, { commitmentId: { $exists: false } }] },
                { $set: { commitmentId: w.commitmentId } }
            ),
            Commitment.updateOne(
                { _id: w.commitmentId, $or: [{ studentId: null }, { studentId: { $exists: false } }] },
                { $set: { studentId: w.studentId } }
            ),
        ]);
        written++;
        if (written % 50 === 0) console.log(`  …wrote ${written}/${writes.length}`);
    }
    console.log(`Wrote ${written} pairs.`);

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});

const Commitment = require('../models/Commitment');
const Student = require('../models/Student');
const { applyHideLucZeroFeeFilter } = require('./studentController');

// All reconciliation endpoints are LUC-only and admin-gated. The drift
// problem doesn't exist on Skillhub (no Commitment lifecycle there), so
// every query hard-codes organization='luc'.

const SCOPE_FROM = new Date('2026-01-01T00:00:00.000Z');

// Closed commitments without a linked Student.
exports.listOrphanCommitments = async (req, res, next) => {
    try {
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 200));
        const rows = await Commitment.find({
            organization: 'luc',
            admissionClosed: true,
            commitmentDate: { $gte: SCOPE_FROM },
            $or: [{ studentId: null }, { studentId: { $exists: false } }],
        })
            .select(
                'studentName consultantName teamName teamLead commitmentDate ' +
                'admissionClosedDate closedAmount leadStage status'
            )
            .sort('-commitmentDate')
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
};

// LUC students without a linked Commitment (and not flagged as manual).
exports.listOrphanStudents = async (req, res, next) => {
    try {
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 200));
        const filter = {
            organization: 'luc',
            closingDate: { $gte: SCOPE_FROM },
            $or: [{ commitmentId: null }, { commitmentId: { $exists: false } }],
            // Manual-entry rows are intentionally unlinked — show them in
            // their own bucket below, not here.
            $and: [{ $or: [{ manualEntry: { $ne: true } }, { manualEntry: { $exists: false } }] }],
        };
        applyHideLucZeroFeeFilter(filter);
        const rows = await Student.find(filter)
            .select('studentName consultantName teamName teamLead closingDate program university courseFee admissionFeePaid manualEntry')
            .sort('-closingDate')
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
};

// Students explicitly marked as manual-entry by an admin (legacy imports,
// edge cases). Surfaced separately so the orphan-students tab stays clean.
exports.listManualStudents = async (req, res, next) => {
    try {
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 200));
        const filter = {
            organization: 'luc',
            closingDate: { $gte: SCOPE_FROM },
            manualEntry: true,
        };
        applyHideLucZeroFeeFilter(filter);
        const rows = await Student.find(filter)
            .select('studentName consultantName teamName closingDate manualEntryReason commitmentId')
            .sort('-closingDate')
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
};

// Headline counters for the page tabs.
exports.getCounts = async (req, res, next) => {
    try {
        const [orphanCommits, orphanStudents, manualStudents] = await Promise.all([
            Commitment.countDocuments({
                organization: 'luc',
                admissionClosed: true,
                commitmentDate: { $gte: SCOPE_FROM },
                $or: [{ studentId: null }, { studentId: { $exists: false } }],
            }),
            (async () => {
                const f = {
                    organization: 'luc',
                    closingDate: { $gte: SCOPE_FROM },
                    $or: [{ commitmentId: null }, { commitmentId: { $exists: false } }],
                    $and: [{ $or: [{ manualEntry: { $ne: true } }, { manualEntry: { $exists: false } }] }],
                };
                applyHideLucZeroFeeFilter(f);
                return Student.countDocuments(f);
            })(),
            (async () => {
                const f = {
                    organization: 'luc',
                    closingDate: { $gte: SCOPE_FROM },
                    manualEntry: true,
                };
                applyHideLucZeroFeeFilter(f);
                return Student.countDocuments(f);
            })(),
        ]);
        res.status(200).json({
            success: true,
            data: { orphanCommits, orphanStudents, manualStudents },
        });
    } catch (err) {
        next(err);
    }
};

// Pair an orphan student with an orphan commitment in one shot.
// Body: { studentId, commitmentId }. Validates both are LUC, both are
// currently unlinked, then writes both FKs + clears manualEntry.
exports.pair = async (req, res, next) => {
    try {
        const { studentId, commitmentId } = req.body || {};
        if (!studentId || !commitmentId) {
            return res.status(400).json({
                success: false,
                message: 'studentId and commitmentId are required',
            });
        }
        const [student, commit] = await Promise.all([
            Student.findById(studentId),
            Commitment.findById(commitmentId),
        ]);
        if (!student || !commit) {
            return res.status(404).json({ success: false, message: 'Student or commitment not found' });
        }
        if (student.organization !== 'luc' || commit.organization !== 'luc') {
            return res.status(400).json({ success: false, message: 'Pairing is LUC-only' });
        }
        if (student.commitmentId) {
            return res.status(409).json({ success: false, message: 'Student is already linked' });
        }
        if (commit.studentId) {
            return res.status(409).json({ success: false, message: 'Commitment is already linked' });
        }

        const commitUpdate = { studentId: student._id };
        if (!commit.admissionClosed) {
            commitUpdate.admissionClosed = true;
            commitUpdate.admissionClosedDate = new Date();
            commitUpdate.status = 'achieved';
            commitUpdate.achievementPercentage = 100;
        }
        await Promise.all([
            Student.updateOne(
                { _id: student._id },
                {
                    $set: {
                        commitmentId: commit._id,
                        manualEntry: false,
                        manualEntryReason: '',
                    },
                }
            ),
            Commitment.updateOne({ _id: commit._id }, { $set: commitUpdate }),
        ]);

        res.status(200).json({
            success: true,
            data: { studentId: student._id, commitmentId: commit._id },
        });
    } catch (err) {
        next(err);
    }
};

const PaymentPlan = require('../models/PaymentPlan');
const Student = require('../models/Student');
const { buildScopeFilter, canAccessDoc } = require('../middleware/auth');
const { emitToOrg } = require('../services/realtime');

// LUC-only feature. All routes are already gated by protect + orgGate('luc')
// + authorize('admin','team_lead'); scoping to a team lead's own rows is done
// here via buildScopeFilter / canAccessDoc (same helpers the rest of the app
// uses). Admin sees every team; team_lead only their own.

// @desc    List payment plans (scoped: team_lead → own team, admin → all)
// @route   GET /api/payment-plans
// @access  Private (admin, team_lead)
exports.getPaymentPlans = async (req, res, next) => {
    try {
        const filter = { ...buildScopeFilter(req), organization: 'luc' };
        // Team-grouped, newest-first — the admin view groups rows by team.
        const plans = await PaymentPlan.find(filter)
            .sort({ teamName: 1, createdAt: -1 })
            .lean();
        res.status(200).json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a payment plan from a linked LUC student
// @route   POST /api/payment-plans
// @access  Private (admin, team_lead — team_lead limited to own-team students)
exports.createPaymentPlan = async (req, res, next) => {
    try {
        const { studentId, status, remarks } = req.body;
        if (!studentId) {
            return res.status(400).json({ success: false, message: 'studentId is required' });
        }

        const student = await Student.findById(studentId).populate('teamLead', 'name teamName');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        if (student.organization !== 'luc') {
            return res.status(400).json({ success: false, message: 'Payment plans are LUC-only' });
        }
        // Team leads can only link students on their own team.
        if (!canAccessDoc(req.user, student)) {
            return res.status(403).json({ success: false, message: 'Not authorized to link this student' });
        }

        // One payment plan per admission — friendly 409 before the unique
        // index would otherwise raise a raw duplicate-key error.
        const existing = await PaymentPlan.findOne({ student: student._id }).select('_id');
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'A payment plan already exists for this student.',
            });
        }

        const teamLeadId = student.teamLead?._id || student.teamLead;
        const doc = await PaymentPlan.create({
            organization: 'luc',
            student: student._id,
            studentName: student.studentName,
            program: student.program || '',
            month: student.month || '',
            consultantName: student.consultantName || '',
            teamLead: teamLeadId,
            teamLeadName: student.teamLeadName || student.teamLead?.name || '',
            teamName: student.teamName || student.teamLead?.teamName || '',
            status: status || 'Pending from TL',
            remarks: remarks || '',
            createdBy: req.user._id,
            lastUpdatedBy: req.user._id,
        });

        emitToOrg('luc', 'paymentPlan:created', { id: String(doc._id) });
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a payment plan's status / remarks
// @route   PUT /api/payment-plans/:id
// @access  Private (admin, team_lead — own team only)
exports.updatePaymentPlan = async (req, res, next) => {
    try {
        const plan = await PaymentPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Payment plan not found' });
        }
        if (!canAccessDoc(req.user, plan)) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this payment plan' });
        }

        const { status, remarks } = req.body;
        if (status !== undefined) plan.status = status;
        if (remarks !== undefined) plan.remarks = remarks;
        plan.lastUpdatedBy = req.user._id;
        await plan.save(); // runs the status enum validator

        emitToOrg('luc', 'paymentPlan:updated', { id: String(plan._id) });
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a payment plan
// @route   DELETE /api/payment-plans/:id
// @access  Private (admin, team_lead — own team only)
exports.deletePaymentPlan = async (req, res, next) => {
    try {
        const plan = await PaymentPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Payment plan not found' });
        }
        if (!canAccessDoc(req.user, plan)) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this payment plan' });
        }

        await plan.deleteOne();
        emitToOrg('luc', 'paymentPlan:deleted', { id: String(plan._id) });
        res.status(200).json({ success: true, data: { id: String(plan._id) } });
    } catch (error) {
        next(error);
    }
};

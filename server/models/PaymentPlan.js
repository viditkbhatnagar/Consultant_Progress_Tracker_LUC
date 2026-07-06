const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');

// Payment Plan Tracker — Pending Approvals (Tier Fight → Payment Plans tab).
// One row per LUC admission, tracking the plan through its approval stages.
// LUC-only. Team leads own their team's rows (scoped via `teamLead`); admin
// sees every team. The student's identity/team fields are denormalized at
// link time so the row stays readable if the student is later edited or
// deleted (mirrors the Commitment/Student denormalization convention).
const PAYMENT_PLAN_STATUSES = [
    'Pending from TL',
    'Pending from SM',
    'Pending from FD',
    'Approved and Submitted',
    'Pending from Student',
    'Drop Out',
];

const PaymentPlanSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_LUC,
            required: true,
            index: true,
        },
        // Linked LUC admission this payment plan is for. One plan per
        // admission — the unique index is the hard backstop; the controller
        // also pre-checks so callers get a friendly 409 instead of a raw
        // duplicate-key error.
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
            unique: true,
        },
        // ── Denormalized snapshot from the linked student ───────────────
        studentName: { type: String, required: true, trim: true },
        program: { type: String, default: '', trim: true },
        month: { type: String, default: '', trim: true },
        consultantName: { type: String, default: '', trim: true },

        // ── Ownership (drives buildScopeFilter / canAccessDoc) ──────────
        teamLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        teamLeadName: { type: String, default: '', trim: true },
        teamName: { type: String, default: '', trim: true },

        // ── Approval tracking ───────────────────────────────────────────
        status: {
            type: String,
            enum: PAYMENT_PLAN_STATUSES,
            default: 'Pending from TL',
            required: true,
        },
        remarks: { type: String, default: '', trim: true },

        // ── Audit ───────────────────────────────────────────────────────
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// Team-grouped, newest-first — matches the admin "grouped by team" view.
PaymentPlanSchema.index({ organization: 1, teamLead: 1, createdAt: -1 });

PaymentPlanSchema.statics.STATUSES = PAYMENT_PLAN_STATUSES;

module.exports = mongoose.model('PaymentPlan', PaymentPlanSchema);

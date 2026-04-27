const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');
const { LEAD_STAGES } = require('./Commitment');

const MEETING_MODES = ['Zoom', 'Out Meeting', 'Office Meeting', 'Student Meeting'];

const MeetingSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_LUC,
            required: true,
            index: true,
        },

        // The calendar date the meeting took place (or is scheduled for).
        // Meetings have no week-bound validation — any role may backdate
        // or forward-date.
        meetingDate: {
            type: Date,
            required: [true, 'Meeting date is required'],
        },

        studentName: {
            type: String,
            required: [true, 'Student name is required'],
            trim: true,
        },
        program: {
            type: String,
            required: [true, 'Program is required'],
            trim: true,
        },
        mode: {
            type: String,
            enum: MEETING_MODES,
            required: [true, 'Meeting mode is required'],
        },

        // Ownership. `consultant` is optional — the Team Lead may also log a
        // meeting as the person who conducted it, in which case we store the
        // TL's name in `consultantName` and leave the consultant ref null
        // (TLs live in the User collection, not the Consultant collection).
        consultant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Consultant',
            default: null,
        },
        consultantName: {
            type: String,
            required: [true, 'Consultant name is required'],
            trim: true,
        },
        teamLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Team lead is required'],
        },
        teamLeadName: {
            type: String,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: LEAD_STAGES,
            required: [true, 'Status is required'],
        },
        remarks: {
            type: String,
            trim: true,
            default: '',
        },

        // ── Cross-tracker link (LUC) ────────────────────────────────────
        // FK to the Commitment row this meeting is associated with. Required
        // at controller level when status='Admission' (LUC) so an admission
        // meeting always pairs to a closed commitment. Optional otherwise.
        commitmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Commitment',
            default: null,
            index: true,
        },

        // Set when admin creates an Admission-status meeting without
        // picking a Commitment FK. Mirrors Student.manualEntry — admin
        // opts out of the linkage with a reason; surfaced on the
        // reconciliation page.
        manualEntry: { type: Boolean, default: false },
        manualEntryReason: { type: String, default: '', trim: true },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

MeetingSchema.index({ organization: 1, meetingDate: -1 });
MeetingSchema.index({ teamLead: 1, meetingDate: -1 });
MeetingSchema.index({ consultant: 1 });

const Meeting = mongoose.model('Meeting', MeetingSchema);

module.exports = Meeting;
module.exports.MEETING_MODES = MEETING_MODES;

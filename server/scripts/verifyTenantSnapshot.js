// Live-DB smoke test for the tenant snapshot used by the chat prompt.
// Prints the snapshot shape so we can eyeball that every field is populated
// and reasonably sized before the LLM ever sees it.

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { getTenantSnapshot } = require('../services/tenantSnapshot');

(async () => {
    const t0 = Date.now();
    await connectDB();
    const snap = await getTenantSnapshot();
    const cold = Date.now() - t0;

    const t1 = Date.now();
    const snap2 = await getTenantSnapshot();
    const warm = Date.now() - t1;

    // Print a condensed view — the fields that end up in the prompt.
    const summary = {
        builtAt: snap.builtAt,
        stale: snap.stale,
        users: {
            admins: snap.users.admins.length,
            managers: snap.users.managers.length,
            skillhubLogins: snap.users.skillhubLogins.length,
            teamLeads: snap.users.teamLeads.map((u) => `${u.teamName} / ${u.name}`),
        },
        teamsInConsultantsByTeam: Object.keys(snap.consultantsByTeam).sort(),
        consultantsCount: Object.values(snap.consultantsByTeam).reduce(
            (s, a) => s + a.length,
            0
        ),
        commitments: {
            total: snap.commitments.total,
            byOrg: snap.commitments.byOrg,
            byStatus: snap.commitments.byStatus,
            topLeadStages: snap.commitments.byLeadStage.slice(0, 5),
            admissionClosedTotal: snap.commitments.admissionClosedTotal,
            admissionClosedWithDate: snap.commitments.admissionClosedWithDate,
            admissionClosedWithAmount: snap.commitments.admissionClosedWithAmount,
            dateRange: snap.commitments.dateRange,
        },
        meetings: snap.meetings,
        students: {
            total: snap.students.total,
            byOrg: snap.students.byOrg,
            lucCoverage: {
                total: snap.students.luc.total,
                withAdmissionFeePaid: snap.students.luc.withAdmissionFeePaid,
                topUniversities: snap.students.luc.universities.slice(0, 5),
                topSources: snap.students.luc.sources.slice(0, 5),
            },
        },
        hourly: {
            total: snap.hourly.total,
            topActivityTypes: snap.hourly.byActivityType.slice(0, 8),
            dateRange: snap.hourly.dateRange,
        },
        timings: { coldMs: cold, warmMs: warm },
        sameInstance: snap === snap2 ? 'yes (cached)' : 'no',
    };

    console.log(JSON.stringify(summary, null, 2));
    await mongoose.connection.close();
    process.exit(0);
})();

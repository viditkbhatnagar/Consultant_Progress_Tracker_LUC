require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { ORG_LUC } = require('../config/organizations');

const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Commitment = require('../models/Commitment');
const Student = require('../models/Student');
const HourlyActivity = require('../models/HourlyActivity');
const DailyAdmission = require('../models/DailyAdmission');
const DailyReference = require('../models/DailyReference');

const MODELS = [
    { name: 'User', model: User },
    { name: 'Consultant', model: Consultant },
    { name: 'Commitment', model: Commitment },
    { name: 'Student', model: Student },
    { name: 'HourlyActivity', model: HourlyActivity },
    { name: 'DailyAdmission', model: DailyAdmission },
    { name: 'DailyReference', model: DailyReference },
];

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    for (const { name, model } of MODELS) {
        const filter = {
            $or: [
                { organization: { $exists: false } },
                { organization: null },
                { organization: '' },
            ],
        };
        const count = await model.countDocuments(filter);
        if (count === 0) {
            console.log(`[${name}] already migrated (0 missing organization)`);
            continue;
        }
        const result = await model.updateMany(filter, {
            $set: { organization: ORG_LUC },
        });
        console.log(
            `[${name}] matched=${result.matchedCount ?? count} modified=${result.modifiedCount ?? 'n/a'} -> organization: '${ORG_LUC}'`
        );
    }

    console.log('\n✅ Migration complete');
    process.exit(0);
};

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});

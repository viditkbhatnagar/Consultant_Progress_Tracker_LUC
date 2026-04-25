// Jest setup for the Export Center pivot specs. Spins an in-memory Mongo,
// connects mongoose to it, and exposes helpers to load fixture rows into a
// model and tear down between specs. Plan §12 Phase 2 step 3.

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

let mongo;

async function startInMemoryMongo() {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri, { dbName: 'tpt-test' });
    return uri;
}

async function stopInMemoryMongo() {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
}

async function clearAllCollections() {
    const cols = await mongoose.connection.db.collections();
    for (const c of cols) await c.deleteMany({});
}

function loadFixture(name) {
    const p = path.join(__dirname, 'fixtures', name);
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// Insert fixture rows directly via the collection so we bypass schema
// validation (some required fields like teamLead are not in the fixture
// and don't matter for pivot correctness).
async function insertRaw(modelName, rows) {
    const Model = mongoose.model(modelName);
    if (rows.length === 0) return;
    // Coerce date-shaped strings to Date for fields the pipelines bucket on.
    const dateFields = ['enquiryDate', 'closingDate', 'createdAt', 'commitmentDate', 'weekStartDate', 'meetingDate', 'date'];
    const coerced = rows.map((r) => {
        const o = { ...r };
        for (const f of dateFields) {
            if (o[f] && typeof o[f] === 'string') {
                const d = new Date(o[f]);
                if (!Number.isNaN(d.getTime())) o[f] = d;
            }
        }
        return o;
    });
    await Model.collection.insertMany(coerced);
}

// A minimal user object good enough to drive the builders. The export
// pipelines read `user.role`, `user._id`, `user.organization`.
function makeAdmin() {
    return {
        _id: new mongoose.Types.ObjectId(),
        role: 'admin',
        organization: 'luc',
        name: 'Test Admin',
    };
}

function makeTeamLead({ teamLeadId, organization = 'luc' } = {}) {
    return {
        _id: teamLeadId || new mongoose.Types.ObjectId(),
        role: 'team_lead',
        organization,
        name: 'Test TL',
    };
}

function makeManager() {
    return {
        _id: new mongoose.Types.ObjectId(),
        role: 'manager',
        organization: 'luc',
        name: 'Test Manager',
    };
}

function makeSkillhub({ teamLeadId, organization = 'skillhub_training' } = {}) {
    return {
        _id: teamLeadId || new mongoose.Types.ObjectId(),
        role: 'skillhub',
        organization,
        name: 'Test Skillhub',
    };
}

module.exports = {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    loadFixture,
    insertRaw,
    makeAdmin,
    makeTeamLead,
    makeManager,
    makeSkillhub,
};

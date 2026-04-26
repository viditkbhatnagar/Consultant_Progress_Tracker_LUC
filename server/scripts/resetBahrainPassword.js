require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL = 'bahrain@learnerseducation.com';
const NEW_PASSWORD = process.argv[2];

(async () => {
    if (!NEW_PASSWORD || NEW_PASSWORD.length < 8) {
        console.error('Usage: node scripts/resetBahrainPassword.js <new-password-min-8-chars>');
        process.exit(1);
    }
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI not set in env');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ email: EMAIL }).select('+password');
    if (!user) {
        console.error(`No user found with email ${EMAIL}`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Found user: ${user.name} (role=${user.role}, isActive=${user.isActive}, org=${user.organization})`);

    user.password = NEW_PASSWORD;
    await user.save();

    console.log(`Password reset for ${EMAIL}.`);
    await mongoose.disconnect();
})().catch(async (err) => {
    console.error(err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});

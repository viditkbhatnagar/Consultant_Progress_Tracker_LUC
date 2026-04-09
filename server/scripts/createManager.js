require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL = 'mushtaq@learnerseducation.com';
const PASSWORD = 'Mushtaq@LE2026!';
const NAME = 'Mushtaq';

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        const existing = await User.findOne({ email: EMAIL });
        if (existing) {
            existing.role = 'manager';
            existing.name = NAME;
            existing.password = PASSWORD;
            existing.isActive = true;
            await existing.save();
            console.log('✅ Updated existing user to manager:', EMAIL);
        } else {
            await User.create({
                email: EMAIL,
                password: PASSWORD,
                name: NAME,
                role: 'manager',
                isActive: true,
            });
            console.log('✅ Manager created:', EMAIL);
        }

        console.log('\n=== Manager Login ===');
        console.log('Email:    ', EMAIL);
        console.log('Password: ', PASSWORD);
        console.log('Role:     manager (view-only access to Student Database)');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();

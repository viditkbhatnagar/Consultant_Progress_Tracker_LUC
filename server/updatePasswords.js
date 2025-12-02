require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('Updating passwords to simple ones...');
    
    await User.findOneAndUpdate({ email: 'admin@learnerseducation.com' }, { password: 'admin123' });
    await User.findOneAndUpdate({ email: 'shasin@learnerseducation.com' }, { password: 'shasin123' });
    await User.findOneAndUpdate({ email: 'arfath@learnerseducation.com' }, { password: 'arfath123' });
    await User.findOneAndUpdate({ email: 'tony@learnerseducation.com' }, { password: 'tony123' });
    
    console.log('✅ Updated passwords:');
    console.log('Admin: admin123');
    console.log('Shasin: shasin123');
    console.log('Arfath: arfath123');
    console.log('Tony: tony123');
    
    process.exit(0);
});

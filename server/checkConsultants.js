require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Consultant = require('./models/Consultant');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('Connected to MongoDB');
    const consultants = await Consultant.find().populate('teamLead', 'name email teamName');
    console.log('\nAll Consultants in Database:');
    console.log('=============================');
    consultants.forEach(c => {
        console.log(`\nConsultant: ${c.name}`);
        console.log(`  Email: ${c.email}`);
        console.log(`  Team Name: ${c.teamName}`);
        console.log(`  Team Lead: ${c.teamLead ? c.teamLead.name : 'NONE'} (${c.teamLead ? c.teamLead.email : 'N/A'})`);
        console.log(`  Team Lead ID: ${c.teamLead ? c.teamLead._id : 'NONE'}`);
        console.log(`  IsActive: ${c.isActive}`);
    });
    process.exit(0);
});

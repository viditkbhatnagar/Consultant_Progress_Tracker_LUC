const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    // Auto-generated serial number per team
    sno: {
        type: Number,
        required: true,
    },
    // Month - auto-populated from closing date
    month: {
        type: String,
        required: true,
    },
    studentName: {
        type: String,
        required: [true, 'Please add student name'],
        trim: true,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female'],
        required: [true, 'Please select gender'],
    },
    program: {
        type: String,
        required: [true, 'Please select program'],
        trim: true,
    },
    university: {
        type: String,
        enum: [
            'Swiss School of Management (SSM)',
            'Knights College',
            'Malaysia University of Science & Technology (MUST)',
            'AGI – American Global Institute (Certifications)',
            'CMBS',
            'OTHM',
        ],
        required: [true, 'Please select university'],
    },
    courseFee: {
        type: Number,
        required: [true, 'Please enter course fee'],
        min: 0,
    },
    source: {
        type: String,
        enum: [
            'Google Ads',
            'Facebook',
            'Tik Tok',
            'Call-In',
            'Old Crm',
            'Linkedin',
            'Whatsapp',
            'Alumni',
            'Seo',
            'Instagram',
            'Reference',
            'B2C',
            'Open Day',
        ],
        required: [true, 'Please select source'],
    },
    campaignName: {
        type: String,
        required: [true, 'Please enter campaign name'],
        trim: true,
    },
    enquiryDate: {
        type: Date,
        required: [true, 'Please select enquiry date'],
    },
    closingDate: {
        type: Date,
        required: [true, 'Please select closing date'],
    },
    // Conversion time - auto-calculated in days
    conversionTime: {
        type: Number,
        default: 0,
    },
    // Consultant name (from dropdown)
    consultantName: {
        type: String,
        required: [true, 'Please select consultant'],
        trim: true,
    },
    // Reference to consultant
    consultant: {
        type: mongoose.Schema.ObjectId,
        ref: 'Consultant',
    },
    // Team lead name - auto-filled based on consultant
    teamLeadName: {
        type: String,
        required: true,
        trim: true,
    },
    // Reference to team lead
    teamLead: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    teamName: {
        type: String,
        required: true,
        trim: true,
    },
    residence: {
        type: String,
        required: [true, 'Please enter residence'],
        trim: true,
    },
    area: {
        type: String,
        required: [true, 'Please enter area'],
        trim: true,
    },
    nationality: {
        type: String,
        required: [true, 'Please enter nationality'],
        trim: true,
    },
    companyName: {
        type: String,
        required: [true, 'Please enter company name'],
        trim: true,
    },
    designation: {
        type: String,
        required: [true, 'Please enter designation'],
        trim: true,
    },
    experience: {
        type: Number,
        required: [true, 'Please enter experience in years'],
        min: 0,
    },
    industryType: {
        type: String,
        required: [true, 'Please enter industry type'],
        trim: true,
    },
    deptType: {
        type: String,
        required: [true, 'Please enter department type'],
        trim: true,
    },
    // Who created this record
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});

// Pre-validate hook to calculate conversion time and set month BEFORE validation
StudentSchema.pre('validate', function () {
    // Calculate conversion time in days
    if (this.enquiryDate && this.closingDate) {
        const enquiry = new Date(this.enquiryDate);
        const closing = new Date(this.closingDate);
        const diffTime = Math.abs(closing - enquiry);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        this.conversionTime = diffDays;
    }

    // Set month from closing date
    if (this.closingDate) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const closingDate = new Date(this.closingDate);
        this.month = months[closingDate.getMonth()];
    }
});

// Static method to get next SNO for a team
StudentSchema.statics.getNextSno = async function (teamLeadId) {
    const lastStudent = await this.findOne({ teamLead: teamLeadId })
        .sort({ sno: -1 })
        .select('sno');
    return lastStudent ? lastStudent.sno + 1 : 1;
};

// Index for efficient queries
StudentSchema.index({ teamLead: 1, closingDate: -1 });
StudentSchema.index({ consultantName: 1 });
StudentSchema.index({ closingDate: -1 });

module.exports = mongoose.model('Student', StudentSchema);

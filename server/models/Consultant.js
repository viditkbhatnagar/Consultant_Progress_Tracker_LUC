const mongoose = require('mongoose');

const ConsultantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add consultant name'],
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    teamName: {
        type: String,
        required: [true, 'Please add team name'],
        trim: true,
    },
    teamLead: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Please add team lead'],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update timestamp on save
ConsultantSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Consultant', ConsultantSchema);

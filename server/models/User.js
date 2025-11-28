const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please add a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            minlength: 6,
            select: false, // Don't return password by default
        },
        name: {
            type: String,
            required: [true, 'Please add a name'],
            trim: true,
        },
        role: {
            type: String,
            enum: ['admin', 'team_lead', 'consultant'],
            required: [true, 'Please specify a role'],
        },

        // Hierarchical relationship
        teamLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        teamName: {
            type: String,
            trim: true,
        },

        // Profile
        phone: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },

        // Timestamps
        lastLogin: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Encrypt password using bcrypt before saving
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

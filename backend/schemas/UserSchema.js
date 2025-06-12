const { Schema } = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters long"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        trim: true,
        lowercase: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please enter a valid email"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters long"],
        select: false // Don't include password in queries by default
    },
    mobile: {
        type: String,
        required: [true, "Mobile number is required"],
        match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number"]
    },
    pan: {
        type: String,
        match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Please enter a valid PAN number"],
        uppercase: true
    },
    dob: {
        type: Date,
        required: [true, "Date of birth is required"]
    },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: {
            type: String,
            match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"]
        }
    },
    bankDetails: {
        accountNumber: {
            type: String,
            sparse: true
        },
        ifscCode: {
            type: String,
            match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please enter a valid IFSC code"],
            uppercase: true
        },
        bankName: String
    },
    kycVerified: {
        type: Boolean,
        default: false
    },
    accountType: {
        type: String,
        enum: ["INDIVIDUAL", "CORPORATE"],
        default: "INDIVIDUAL"
    },
    tradingEnabled: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN"],
        default: "USER"
    },
    lastLogin: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    accountLocked: {
        type: Boolean,
        default: false
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        select: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for unique fields and common queries
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ mobile: 1 }, { unique: true });
UserSchema.index({ pan: 1 }, { unique: true, sparse: true });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ accountType: 1, kycVerified: 1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
    return this.name;
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to check if account is locked
UserSchema.methods.isAccountLocked = function() {
    return this.accountLocked || this.loginAttempts >= 5;
};

// Method to increment login attempts
UserSchema.methods.incrementLoginAttempts = async function() {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
        this.accountLocked = true;
    }
    await this.save();
};

// Method to reset login attempts
UserSchema.methods.resetLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.accountLocked = false;
    await this.save();
};

module.exports = { UserSchema };

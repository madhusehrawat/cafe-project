const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: [true, "Username is required"],
        trim: true 
    },
    email: { 
        type: String, 
        required: [true, "Email is required"], 
        unique: true,
        lowercase: true, 
        trim: true
    },
    password: { 
        type: String, 
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"]
    },
    role: { 
        type: String, 
        enum: ["user", "admin"], 
        default: "user" 
    },
    subscription: { 
        type: Object,
        default: null 
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

// --- PASSWORD HASHING HOOK ---
userSchema.pre('save', async function() {
    // 'this' refers to the user document
    // If the password hasn't changed, just stop here
    if (!this.isModified('password')) {
        return; 
    }

    // Safety check: if it looks like it's already hashed, don't hash it again
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
        return;
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        // In an async function, simply returning is the same as calling next()
    } catch (err) {
        // If there's an error, we throw it so Mongoose catches it
        throw err;
    }
});

// Helper method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
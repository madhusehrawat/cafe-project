const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // Highly recommended

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: [true, "Username is required"],
        trim: true // Removes accidental whitespace
    },
    email: { 
        type: String, 
        required: [true, "Email is required"], 
        unique: true,
        lowercase: true, // Ensures "User@Email.com" matches "user@email.com"
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
    // Changed to null default for easier "if" checks in Web Push
    subscription: { 
        type: Object,
        default: null 
    },
    
    // --- FORGOT PASSWORD FIELDS ---
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, { timestamps: true });

// --- PASSWORD HASHING HOOK ---
// This hashes the password automatically before saving to MongoDB
userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Helper method to compare passwords during login
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
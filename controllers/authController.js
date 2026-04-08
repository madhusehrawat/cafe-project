const User = require("../models/User");
const OtpStore = require("../models/OtpStore");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendOTP = require("../utils/sendotp");

// --- Pages ---
exports.getSignupPage = (req, res) => res.render("signup");
exports.getLoginPage = (req, res) => {
    const returnTo = req.query.returnTo || "";
    res.render("login", { returnTo });
};
exports.getForgotPasswordPage = (req, res) => res.render("forgot-password", { error: null });

// --- Signup Logic ---
exports.postSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, error: "Email already registered." });

        const otp = await sendOTP(email);
        const hashedPassword = await bcrypt.hash(password, 10);

        await OtpStore.findOneAndUpdate(
            { email, type: "signup" },
            { otp, username, password: hashedPassword, createdAt: new Date() },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, message: "OTP sent to your Gmail." });
    } catch (err) {
        res.status(500).json({ success: false, error: "Signup failed." });
    }
};

// --- Verify OTP & Cleanup ---
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const tempData = await OtpStore.findOne({ email, otp, type: "signup" });

        if (!tempData) return res.status(400).json({ success: false, error: "Invalid or expired OTP." });

        const newUser = new User({
            username: tempData.username,
            email: tempData.email,
            password: tempData.password,
            role: "user"
        });

        await newUser.save();
        await OtpStore.deleteOne({ _id: tempData._id }); // Manual cleanup after success

        res.status(201).json({ success: true, message: "Account verified!", redirectUrl: "/login" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Verification failed." });
    }
};

// --- Resend OTP (Fixed: Added this function) ---
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const otp = await sendOTP(email);
        
        await OtpStore.findOneAndUpdate(
            { email, type: "signup" },
            { otp, createdAt: new Date() }, // Resets the 5-minute timer
            { upsert: true }
        );
        res.status(200).json({ success: true, message: "A new OTP has been sent." });
    } catch (err) {
        res.status(500).json({ success: false, error: "Could not resend OTP." });
    }
};

// --- Forgot/Reset Logic ---
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(200).json({ success: true, message: "If email exists, code sent." });

        const resetOtp = await sendOTP(email);
        await OtpStore.findOneAndUpdate(
            { email, type: "password-reset" },
            { otp: resetOtp, createdAt: new Date() },
            { upsert: true }
        );
        res.status(200).json({ success: true, message: "Reset code sent." });
    } catch (err) {
        res.status(500).json({ success: false, error: "Error sending reset code." });
    }
};

exports.resetPasswordWithOTP = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const tempData = await OtpStore.findOne({ email, otp, type: "password-reset" });

        if (!tempData) return res.status(400).json({ success: false, error: "Code expired." });

        const user = await User.findOne({ email });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        await OtpStore.deleteOne({ _id: tempData._id }); // Manual cleanup after success
        res.status(200).json({ success: true, message: "Password updated!" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Reset failed." });
    }
};

// --- Login & Logout ---
exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, error: "Invalid credentials." });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || "secret", { expiresIn: "24h" });
        res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "Strict" });

        const destination = user.role === "admin" ? "/admin/dashboard" : "/products";
        res.status(200).json({ success: true, redirectUrl: destination });
    } catch (err) {
        res.status(500).json({ success: false, error: "Login error." });
    }
};

exports.logout = (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
};
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');

// FIX: Importing the utility and the mailer correctly
const sendOTP = require("../utils/sendotp"); 
const { sendMail } = require("../utils/mailer");

// Initialize memory store for OTPs (Signup & Resets)
const otpStore = new Map();

// --- PAGE RENDERING ---

exports.getSignupPage = (req, res) => res.render("signup");

exports.getLoginPage = (req, res) => {
    const returnTo = req.query.returnTo || "";
    res.render("login", { returnTo });
};

exports.getForgotPasswordPage = (req, res) => {
    res.render("forgot-password", { error: null });
};

// --- AUTH LOGIC ---

exports.postSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, error: "Email already registered" });
        }

        // Use the utility to generate and send the email
        const otp = await sendOTP(email); 
        const hashedPassword = await bcrypt.hash(password, 10);

        otpStore.set(email, {
            username,
            password: hashedPassword,
            otp,
            expires: Date.now() + 300000 // 5 minutes
        });

        res.status(200).json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to send verification email." });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const tempData = otpStore.get(email);

        if (!tempData || tempData.expires < Date.now()) {
            if (tempData) otpStore.delete(email);
            return res.status(400).json({ success: false, error: "OTP expired or invalid session." });
        }

        if (tempData.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid OTP code." });
        }

        const newUser = new User({
            username: tempData.username,
            email: email,
            password: tempData.password,
            role: 'user'
        });

        await newUser.save();
        otpStore.delete(email);

        res.status(201).json({ success: true, message: "Account verified successfully!" });
    } catch (err) {
        console.error("VERIFY ERROR:", err);
        res.status(500).json({ success: false, error: "Account creation failed." });
    }
};

exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const tempData = otpStore.get(email);

        if (!tempData) {
            return res.status(400).json({ success: false, error: "Session expired. Signup again." });
        }

        const newOtp = await sendOTP(email);
        tempData.otp = newOtp;
        tempData.expires = Date.now() + 300000;
        otpStore.set(email, tempData);

        res.json({ success: true, message: "New OTP sent!" });
    } catch (err) {
        console.error("RESEND ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to resend email" });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, error: "No account found." });
        }

        // Generate a fresh code using the utility
        const resetOtp = await sendOTP(email);

        otpStore.set(email, {
            email: user.email,
            otp: resetOtp,
            type: 'password-reset',
            expires: Date.now() + 600000 // 10 minutes
        });

        res.status(200).json({ success: true, message: "Verification code sent." });
    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ success: false, error: "Error sending reset code." });
    }
};

exports.resetPasswordWithOTP = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const tempData = otpStore.get(email);

        if (!tempData || tempData.type !== 'password-reset' || tempData.expires < Date.now()) {
            return res.status(400).json({ success: false, error: "Code expired or invalid session." });
        }

        if (tempData.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid verification code." });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, error: "User not found." });

        user.password = newPassword; // Hashing happens in User model pre-save hook
        await user.save();

        otpStore.delete(email);

        res.status(200).json({ success: true, message: "Password reset successful!" });
    } catch (err) {
        console.error("RESET ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to reset password." });
    }
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password, subscription } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, error: "Invalid email or password" });
        }

        if (subscription) {
            user.pushSubscription = subscription;
            await user.save();
        }

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET || "supersecretkey",
            { expiresIn: "1d" }
        );

        res.cookie("token", token, { 
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 
        });

        const destination = user.role === 'admin' ? '/admin/dashboard' : '/products';
        res.status(200).json({ success: true, redirectUrl: destination });
    } catch (err) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};

exports.logout = async (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
};
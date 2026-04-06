const User = require("../models/User");
const OtpStore = require("../models/OtpStore");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const sendOTP = require("../utils/sendotp"); // uses Nodemailer internally

// ─────────────────────────────────────────────
// PAGE RENDERING
// ─────────────────────────────────────────────

exports.getSignupPage = (req, res) => res.render("signup");

exports.getLoginPage = (req, res) => {
    const returnTo = req.query.returnTo || "";
    res.render("login", { returnTo });
};

exports.getForgotPasswordPage = (req, res) => {
    res.render("forgot-password", { error: null });
};

// ─────────────────────────────────────────────
// SIGNUP — sends OTP, stores pending data in DB
// ─────────────────────────────────────────────

exports.postSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Check if a verified user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: "Email already registered. Please login."
            });
        }

        // 2. Hash password before sending email (keeps response fast)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Send OTP email
        const otp = await sendOTP(email);

        // 4. Upsert into OtpStore (overwrites any previous pending signup for this email)
        await OtpStore.findOneAndUpdate(
            { email },
            {
                otp,
                type: "signup",
                username,
                password: hashedPassword,
                expires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
            },
            { upsert: true, new: true }
        );

        console.log(`✅ OTP stored in DB for ${email}`);

        res.status(200).json({
            success: true,
            message: "A verification code has been sent to your email."
        });

    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        res.status(500).json({
            success: false,
            error: "Failed to process signup. Please check your email address."
        });
    }
};

// ─────────────────────────────────────────────
// VERIFY OTP — creates the user account
// ─────────────────────────────────────────────

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const tempData = await OtpStore.findOne({ email, type: "signup" });

        // Not found OR already expired
        if (!tempData || tempData.expires < new Date()) {
            if (tempData) await OtpStore.deleteOne({ email });
            return res.status(400).json({
                success: false,
                error: "OTP expired or invalid session. Please sign up again."
            });
        }

        if (tempData.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid OTP code." });
        }

        // Create the verified user
        const newUser = new User({
            username: tempData.username,
            email,
            password: tempData.password, // already hashed
            role: "user"
        });

        await newUser.save();
        await OtpStore.deleteOne({ email }); // clean up

        res.status(201).json({ success: true, message: "Account verified successfully!" });

    } catch (err) {
        console.error("VERIFY ERROR:", err);
        res.status(500).json({ success: false, error: "Account creation failed." });
    }
};

// ─────────────────────────────────────────────
// RESEND OTP — refreshes code for pending signup
// ─────────────────────────────────────────────

exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        const tempData = await OtpStore.findOne({ email, type: "signup" });

        if (!tempData) {
            return res.status(400).json({
                success: false,
                error: "Session expired. Please sign up again."
            });
        }

        // Generate a fresh OTP and reset expiry
        const newOtp = await sendOTP(email);

        tempData.otp = newOtp;
        tempData.expires = new Date(Date.now() + 5 * 60 * 1000);
        await tempData.save();

        res.json({ success: true, message: "New OTP sent!" });

    } catch (err) {
        console.error("RESEND ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to resend OTP." });
    }
};

// ─────────────────────────────────────────────
// FORGOT PASSWORD — sends reset code
// ─────────────────────────────────────────────

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            // Return generic message to avoid user enumeration
            return res.status(200).json({
                success: true,
                message: "If that email exists, a verification code has been sent."
            });
        }

        const resetOtp = await sendOTP(email);

        await OtpStore.findOneAndUpdate(
            { email },
            {
                otp: resetOtp,
                type: "password-reset",
                username: undefined,
                password: undefined,
                expires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: "If that email exists, a verification code has been sent."
        });

    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ success: false, error: "Error sending reset code." });
    }
};

// ─────────────────────────────────────────────
// RESET PASSWORD WITH OTP
// ─────────────────────────────────────────────

exports.resetPasswordWithOTP = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const tempData = await OtpStore.findOne({ email, type: "password-reset" });

        if (!tempData || tempData.expires < new Date()) {
            if (tempData) await OtpStore.deleteOne({ email });
            return res.status(400).json({
                success: false,
                error: "Code expired or invalid session."
            });
        }

        if (tempData.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid verification code." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found." });
        }

        // Assign raw password — hashing handled by User model pre-save hook
        user.password = newPassword;
        await user.save();

        await OtpStore.deleteOne({ email }); // clean up

        res.status(200).json({ success: true, message: "Password reset successful!" });

    } catch (err) {
        console.error("RESET ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to reset password." });
    }
};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

exports.postLogin = async (req, res) => {
    try {
        const { email, password, subscription } = req.body;

        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        // Save push notification subscription if provided
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
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        const destination = user.role === "admin" ? "/admin/dashboard" : "/products";
        res.status(200).json({ success: true, redirectUrl: destination });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

exports.logout = (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
};
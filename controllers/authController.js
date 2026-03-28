const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require('crypto');

// --- UTILS: Transporter ---
// Defined once at the top to be used by all functions
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

const otpStore = new Map(); 

// --- PAGE RENDERING ---

exports.getSignupPage = (req, res) => {
    res.render("signup");
};

exports.getLoginPage = (req, res) => {
    const returnTo = req.query.returnTo || "";
    res.render("login", { returnTo });
};

// ADDED: This was missing and likely causing your router crash
exports.getForgotPasswordPage = (req, res) => {
    res.render("forgot-password", { error: null });
};

exports.getResetPasswordPage = async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            // Render forgot-password but pass an error message to display in the UI
            return res.render("forgot-password", { error: "Reset link is invalid or has expired." });
        }

        res.render("reset-password", { token: req.params.token });
    } catch (err) {
        res.status(500).send("Internal Server Error");
    }
};

// --- AUTH LOGIC ---

exports.postSignup = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, error: "Email already registered" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 10);

        otpStore.set(email, {
            username,
            password: hashedPassword,
            otp,
            expires: Date.now() + 300000 
        });

        const mailOptions = {
            from: '"FullStack Cafe" <no-reply@fullstackcafe.com>',
            to: email,
            subject: "Verify Your Email - FullStack Cafe",
            html: `<h3>Welcome to the Cafe!</h3>
                   <p>Your verification code is: <strong>${otp}</strong></p>
                   <p>This code expires in 5 minutes.</p>`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        res.status(500).json({ success: false, error: "Error sending OTP email" });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const tempData = otpStore.get(email);

        if (!tempData || tempData.expires < Date.now()) {
            if (tempData) otpStore.delete(email);
            return res.status(400).json({ success: false, error: "OTP expired or invalid." });
        }

        if (tempData.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid OTP" });
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
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, error: "Invalid email or password" });
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

// Function to save or update a user's Web Push subscription
exports.subscribe = async (req, res) => {
    try {
        const subscription = req.body;

        // 1. Validate the subscription object
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid subscription data provided." 
            });
        }

        // 2. Update the user document in MongoDB
        // We use req.user.id from your auth middleware
        const user = await User.findByIdAndUpdate(
            req.user.id, 
            { subscription: subscription },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: "User not found." 
            });
        }

        console.log(`Push subscription saved for user: ${user.username}`);
        
        res.status(201).json({ 
            success: true, 
            message: "Push subscription saved successfully." 
        });

    } catch (err) {
        console.error("SUBSCRIBE_ERROR:", err);
        res.status(500).json({ 
            success: false, 
            error: "Failed to save subscription." 
        });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, error: "User not found with this email" });
        }

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        //const resetUrl = `http://${req.headers.host}/reset-password/${token}`;
        const resetUrl = `http://10.191.74.218:3000/reset-password/${token}`;
       
        const mailOptions = {
            to: user.email,
            from: '"FullStack Cafe" <noreply@fullstackcafe.com>',
            subject: 'Password Reset Request',
            html: `<h3>Password Reset</h3>
                   <p>You requested a password reset. Click the link below to proceed:</p>
                   <a href="${resetUrl}">${resetUrl}</a>
                   <p>If you did not request this, please ignore this email.</p>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Reset link sent to your email!" });
    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ success: false, error: "Error sending email" });
    }
};

exports.postResetPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, error: "Token is invalid or expired." });
        }

        // Set the new password - the User model's pre-save hook will hash this
        user.password = password; 
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        
        await user.save();
        res.json({ success: true, message: "Password updated successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to update password." });
    }
};
// Add this to controllers/authController.js
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const tempData = otpStore.get(email);

        if (!tempData) {
            return res.status(400).json({ success: false, error: "Session expired. Please signup again." });
        }

        // Generate new 6-digit OTP
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Update the store with new OTP and refresh expiry (5 mins)
        tempData.otp = newOtp;
        tempData.expires = Date.now() + 300000; 
        otpStore.set(email, tempData);

        await transporter.sendMail({
            from: '"FullStack Cafe" <no-reply@fullstackcafe.com>',
            to: email,
            subject: "New Verification Code - FullStack Cafe",
            html: `<p>Your new verification code is: <strong>${newOtp}</strong></p>`
        });

        res.json({ success: true, message: "New OTP sent!" });
    } catch (err) {
        console.error("RESEND ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to resend email" });
    }
};
exports.logout = (req, res) => {
    res.clearCookie("token"); // Clears the JWT cookie
    
    // If it's an AJAX/Fetch request (JSON)
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ success: true, redirectUrl: "/login" });
    }
    
    // If it's a normal link click (GET)
    res.redirect("/login");
};
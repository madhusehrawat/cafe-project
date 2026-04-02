const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
//const nodemailer = require("nodemailer");
const mailer = require("../utils/mailer"); // Import the CafeMailer class
const crypto = require('crypto');

// --- UTILS: Transporter ---
const dns = require('dns');

// 1. Force the entire application to prefer IPv4 over IPv6
//dns.setDefaultResultOrder('ipv4first');

// const transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 587,
//     secure: false, // Must be false for 587
//     // This is the line that usually solves it for Render:
//     family: 4, 
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS 
//     },
//     tls: {
//         // This ensures the connection isn't dropped by Render's firewall
//         rejectUnauthorized: false,
//         servername: 'smtp.gmail.com'
//     },
//     connectionTimeout: 25000, // Increased to 25s for Render Free Tier
//     greetingTimeout: 25000
// });
// transporter.verify((error, success) => {
//     if (error) {
//         console.log("SMTP Connection Error:", error);
//     } else {
//         console.log("Server is ready to send emails!");
//     }
// });

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

        // 1. Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, error: "Email already registered" });
        }

        // 2. Generate OTP and Hash Password
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Store temporary data
        otpStore.set(email, {
            username,
            password: hashedPassword,
            otp,
            expires: Date.now() + 300000 // 5 minutes
        });

        // 4. Use your CUSTOM TRANSPORTER method
        // This is much cleaner and handles the Render IPv4 fixes automatically
        await mailer.sendOTP(email, otp);

        res.status(200).json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        // If the email fails, we should clear the otpStore so they can try again fresh
        otpStore.delete(req.body.email); 
        res.status(500).json({ success: false, error: "Failed to send verification email. Please try again." });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const tempData = otpStore.get(email);

        // 1. Validate OTP and Expiry
        if (!tempData || tempData.expires < Date.now()) {
            if (tempData) otpStore.delete(email);
            return res.status(400).json({ success: false, error: "OTP expired or invalid session." });
        }

        // 2. Check if OTP matches
        if (tempData.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid OTP code." });
        }

        // 3. Create and Save New User
        const newUser = new User({
            username: tempData.username,
            email: email,
            password: tempData.password,
            role: 'user'
        });

        await newUser.save();

        // 4. Cleanup: Clear the temporary store
        otpStore.delete(email);

        res.status(201).json({ success: true, message: "Account verified successfully!" });
    } catch (err) {
        console.error("VERIFY ERROR:", err);
        res.status(500).json({ success: false, error: "Account creation failed." });
    }
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password, subscription } = req.body; // Added subscription here
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, error: "Invalid email or password" });
        }

        // Save subscription if provided during login
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
        console.error("LOGIN ERROR:", err); // Always log the error to see it in terminal
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};
// Function to save or update a user's Web Push subscription
// exports.subscribe = async (req, res) => {
//     try {
//         const subscription = req.body;

//         // 1. Validate the subscription object
//         if (!subscription || !subscription.endpoint) {
//             return res.status(400).json({ 
//                 success: false, 
//                 error: "Invalid subscription data provided." 
//             });
//         }

//         // 2. Update the user document in MongoDB
//         // We use req.user.id from your auth middleware
//         const user = await User.findByIdAndUpdate(
//             req.user.id, 
//             { subscription: subscription },
//             { new: true }
//         );

//         if (!user) {
//             return res.status(404).json({ 
//                 success: false, 
//                 error: "User not found." 
//             });
//         }

//         console.log(`Push subscription saved for user: ${user.username}`);
        
//         res.status(201).json({ 
//             success: true, 
//             message: "Push subscription saved successfully." 
//         });

//     } catch (err) {
//         console.error("SUBSCRIBE_ERROR:", err);
//         res.status(500).json({ 
//             success: false, 
//             error: "Failed to save subscription." 
//         });
//     }
// };
// Step 1: Send OTP for Password Reset
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, error: "No account found with this email." });
        }

        // Generate a 6-digit OTP specifically for reset
        const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store in otpStore with a 'reset' flag
        otpStore.set(email, {
            email: user.email,
            otp: resetOtp,
            type: 'password-reset', // Distinguish this from signup OTP
            expires: Date.now() + 600000 // 10 minutes
        });

        // Use your custom mailer
        await mailer.sendMail({
            to: user.email,
            subject: "Reset Your Password - FullStack Cafe",
            html: `<h3>Password Reset Request</h3>
                   <p>Your verification code is: <strong>${resetOtp}</strong></p>
                   <p>Enter this code in the app to reset your password.</p>`
        });

        res.status(200).json({ success: true, message: "Verification code sent to your email." });
    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ success: false, error: "Error sending reset code." });
    }
};

// Step 2: Verify the OTP and then actually change the password
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

        // OTP is correct, find user and update password
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, error: "User not found." });

        user.password = newPassword; // Pre-save hook in User model will hash this
        await user.save();

        // Cleanup
        otpStore.delete(email);

        res.status(200).json({ success: true, message: "Password reset successful! You can now login." });
    } catch (err) {
        console.error("RESET ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to reset password." });
    }
};
exports.postResetPassword = async (req, res) => {
    try {
        const { password } = req.body;
        
        // Find user with valid token and check if not expired
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, error: "Token is invalid or expired." });
        }

        // Update password (User model pre-save hook will hash this)
        user.password = password; 
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        
        await user.save();
        res.json({ success: true, message: "Password updated successfully!" });
    } catch (err) {
        console.error("RESET PASSWORD ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to update password." });
    }
};
// Add this to controllers/authController.js
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const tempData = otpStore.get(email);

        // 1. Check if the session still exists in memory
        if (!tempData) {
            return res.status(400).json({ 
                success: false, 
                error: "Session expired. Please signup again." 
            });
        }

        // 2. Generate new 6-digit OTP
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 3. Update the store with new OTP and refresh expiry (5 mins)
        tempData.otp = newOtp;
        tempData.expires = Date.now() + 300000; 
        otpStore.set(email, tempData);

        // 4. FIXED: Use your custom mailer service instead of the undefined transporter
        await mailer.sendOTP(email, newOtp);

        res.json({ success: true, message: "New OTP sent!" });
    } catch (err) {
        console.error("RESEND ERROR:", err);
        res.status(500).json({ success: false, error: "Failed to resend email" });
    }
};
exports.logout = async (req, res) => {
    try {
        // Use req.user._id (populated by your checkAuth middleware)
        if (req.user && req.user._id) {
            await User.findByIdAndUpdate(req.user._id, {
                $set: { pushSubscription: null }, 
            });
        }

        res.clearCookie("token");

        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf("json") > -1)) {
            return res.json({ success: true, redirectUrl: "/login" });
        }

        res.redirect("/login");
    } catch (err) {
        console.error("Logout Error:", err);
        res.redirect("/login");
    }
};
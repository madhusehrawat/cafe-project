const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");


// Registration
router.get("/signup", authController.getSignupPage);
router.post("/signup", authController.postSignup);

// Add these to your existing routes
router.get("/verify-otp", (req, res) => res.render("verify-otp"));
router.post("/verify-otp", authController.verifyOTP);
router.post("/resend-otp", authController.resendOTP);
router.get('/forgot-password', authController.getForgotPasswordPage);

router.post('/forgot-password', authController.forgotPassword);

router.get('/reset-password/:token', authController.getResetPasswordPage);

router.post('/reset-password/:token', authController.postResetPassword);
// Login
router.get("/login", authController.getLoginPage);
router.post("/login", authController.postLogin);

router.post('/subscribe', requireAuth, authController.subscribe);

// Logout (Line 12 - Make sure logout is defined in controller)
router.get("/logout", authController.logout);

module.exports = router;
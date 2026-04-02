const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// --- Pages ---
router.get('/signup', authController.getSignupPage);
router.get('/login', authController.getLoginPage);
router.get('/forgot-password', authController.getForgotPasswordPage);

// FIX 1: getResetPasswordPage was removed from your controller 
// If you still want to render a reset page, you need to add it back to the controller.
// For now, I'll comment it out to stop the crash.
// router.get('/reset-password/:token', authController.getResetPasswordPage);

router.get('/verify-otp', (req, res) => res.render('verify-otp')); 
router.get('/logout', authController.logout);

// --- Logic ---
router.post('/signup', authController.postSignup);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/login', authController.postLogin);

// FIX 2: postResetPassword was not in your shared controller code.
// You are now using resetPasswordWithOTP for the logic.
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password-verify', authController.resetPasswordWithOTP);

// FIX 3: Same as Fix 1 & 2. Commenting out to prevent crash.
// router.post('/reset-password/:token', authController.postResetPassword);

module.exports = router;
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Pages
router.get('/signup', authController.getSignupPage);
router.get('/login', authController.getLoginPage);
router.get('/forgot-password', authController.getForgotPasswordPage);
router.get('/verify-otp', (req, res) => res.render('verify-otp')); 
router.get('/logout', authController.logout);

// Logic
router.post('/signup', authController.postSignup);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP); // Now this works!
router.post('/login', authController.postLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password-verify', authController.resetPasswordWithOTP);

module.exports = router;

// FIX 3: Same as Fix 1 & 2. Commenting out to prevent crash.
// router.post('/reset-password/:token', authController.postResetPassword);

module.exports = router;
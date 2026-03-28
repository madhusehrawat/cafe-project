const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Pages
router.get('/signup', authController.getSignupPage);
router.get('/login', authController.getLoginPage);
router.get('/forgot-password', authController.getForgotPasswordPage);
router.get('/reset-password/:token', authController.getResetPasswordPage);
router.get('/verify-otp', (req, res) => res.render('verify-otp')); // Simple render
router.get('/logout', authController.logout);

// Logic
router.post('/signup', authController.postSignup);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/login', authController.postLogin);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.postResetPassword);

// Push Notifications
router.post('/subscribe', requireAuth, authController.subscribe);

module.exports = router;
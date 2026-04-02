const nodemailer = require('nodemailer');
const dns = require('dns');

// 1. GLOBAL FIX: This tells your Node.js app to ignore IPv6.
// This is the #1 fix for the 'ENETUNREACH' error on Render.
dns.setDefaultResultOrder('ipv4first');

class CafeMailer {
    constructor() {
        // 2. Create the internal transporter
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // TLS
            family: 4,     // Force IPv4
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false,
                servername: 'smtp.gmail.com'
            },
            connectionTimeout: 20000,
            greetingTimeout: 20000
        });

        // 3. Self-Verify: Automatically checks connection when the server starts
        this.transporter.verify((error) => {
            if (error) {
                console.error("❌ Mailer Connection Failed:", error.message);
            } else {
                console.log("✅ Mailer Status: IPv4 Connection Secured!");
            }
        });
    }

    /**
     * Custom method to send OTPs
     * @param {string} email - Recipient
     * @param {string} otp - The 6-digit code
     */
    async sendOTP(email, otp) {
        const mailOptions = {
            from: `"FullStack Cafe" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Verification Code',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                    <h2 style="color: #5d4037;">FullStack Cafe</h2>
                    <p>Use the code below to verify your account:</p>
                    <div style="font-size: 24px; font-weight: bold; color: #ff6f00;">${otp}</div>
                    <p>This code expires in 5 minutes.</p>
                </div>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log("📧 OTP sent to:", email);
            return info;
        } catch (err) {
            console.error("📧 Delivery Error:", err.message);
            throw err;
        }
    }


// Add this INSIDE your CafeMailer class in utils/mailer.js
async sendMail(options) {
    try {
        const info = await this.transporter.sendMail({
            from: `"FullStack Cafe" <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            html: options.html
        });
        return info;
    } catch (err) {
        console.error("Custom Mailer Error:", err);
        throw err;
    }
}
}

// Export a single instance (Singleton)
module.exports = new CafeMailer();
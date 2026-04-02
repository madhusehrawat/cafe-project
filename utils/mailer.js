require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail", 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

const verifyConnection = async () => {
    try {
        await transporter.verify();
        console.log("✅ Mail server ready");
    } catch (err) {
        console.error("❌ Mail Error:", err.message);
    }
};

const sendMail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
            from: `"FullStack Cafe" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log("✅ Email sent:", info.messageId);
        return info;
    } catch (err) {
        console.error("❌ Email send error:", err.message);
        throw err;
    }
};

module.exports = {
    sendMail,
    verifyConnection,
    transporter // Exported so sendotp.js can use it
};
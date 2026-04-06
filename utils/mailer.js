require("dotenv").config();
const nodemailer = require("nodemailer");

// Creates a Gmail transporter using App Password (works on Render)
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS  // 16-character Gmail App Password
    },
    tls: {
        rejectUnauthorized: false
    }
});

const sendMail = async ({ to, subject, html }) => {
    const mailOptions = {
        from: `"FullStack Cafe" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { messageId: info.messageId };
};

const verifyConnection = async () => {
    try {
        await transporter.verify();
        console.log("✅ Nodemailer Gmail connection is ready");
        return true;
    } catch (err) {
        console.error("❌ Mailer verification failed:", err.message);
        return false;
    }
};

module.exports = { sendMail, verifyConnection };
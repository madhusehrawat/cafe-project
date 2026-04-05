require("dotenv").config();
const nodemailer = require("nodemailer");

/* ================= TRANSPORT CONFIGURATION ================= */
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use STARTTLS (more reliable on cloud providers than Port 465)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    /* FIX: These settings specifically prevent the ENETUNREACH 
       and Timeout errors on Render.
    */
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    dnsV6: false, // Forces IPv4 resolution
    tls: {
        rejectUnauthorized: false, // Prevents certificate handshake issues
        minVersion: "TLSv1.2"
    }
});

/* ================= VERIFY CONNECTION ================= */
const verifyConnection = async () => {
    try {
        await transporter.verify();
        console.log("✅ Mail server ready (IPv4/Port 587)");
    } catch (err) {
        console.error("❌ Mail Error:", err.message);
        // Suggestive hint for common Render issues
        if (err.code === 'ENETUNREACH') {
            console.error("HINT: Network unreachable. Ensure Node is running in IPv4-first mode.");
        }
    }
};

/* ================= SEND MAIL FUNCTION ================= */
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
    transporter 
};
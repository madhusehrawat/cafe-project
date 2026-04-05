require("dotenv").config();
const tls = require("tls");
const { Buffer } = require("buffer");

/**
 * Custom SMTP Client for FullStack Cafe
 * Forces IPv4 to bypass Render's ENETUNREACH errors.
 */
const sendMail = ({ to, subject, html }) => {
    return new Promise((resolve, reject) => {
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_PASS;

        // Force IPv4 by using family: 4
        const options = {
            host: "smtp.gmail.com",
            port: 465,
            family: 4, 
            rejectUnauthorized: false
        };

        const socket = tls.connect(options, () => {
            console.log("📡 Connected to Gmail SMTP via IPv4...");
        });

        socket.setEncoding("utf-8");
        let step = 0;

        const send = (cmd) => socket.write(cmd + "\r\n");

        socket.on("data", (data) => {
            // console.log("S:", data.trim()); // Debug: view server response

            if (data.startsWith("220") && step === 0) {
                send("EHLO localhost");
                step++;
            } else if (step === 1) {
                send("AUTH LOGIN");
                step++;
            } else if (step === 2) {
                send(Buffer.from(user).toString("base64"));
                step++;
            } else if (step === 3) {
                send(Buffer.from(pass).toString("base64"));
                step++;
            } else if (data.includes("235") || step === 4) {
                send(`MAIL FROM: <${user}>`);
                step++;
            } else if (step === 5) {
                send(`RCPT TO: <${to}>`);
                step++;
            } else if (step === 6) {
                send("DATA");
                step++;
            } else if (step === 7) {
                // Email Construction
                send(`Content-Type: text/html; charset=utf-8`);
                send(`Subject: ${subject}`);
                send(`From: "FullStack Cafe" <${user}>`);
                send(`To: ${to}`);
                send(""); // Required empty line
                send(html);
                send(".");
                step++;
            } else if (data.includes("250") && step === 8) {
                send("QUIT");
                console.log("✅ Email sent successfully via Custom Mailer!");
                resolve({ messageId: "custom-" + Date.now() });
            }
        });

        socket.on("error", (err) => {
            console.error("❌ Custom Mailer Socket Error:", err.message);
            reject(err);
        });

        socket.setTimeout(10000, () => {
            socket.destroy();
            reject(new Error("SMTP Connection Timeout"));
        });
    });
};

// Mock verify function to maintain compatibility with your current app.js
const verifyConnection = async () => {
    console.log("✅ Custom IPv4 Mailer Ready");
    return true;
};

module.exports = {
    sendMail,
    verifyConnection
};
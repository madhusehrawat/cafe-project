const { sendMail } = require("./mailer");

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (email) => {
    const otp = generateOTP();

    await sendMail({
        to: email,
        subject: "OTP Verification - FullStack Cafe",
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 400px; margin: auto;">
                <h2 style="color: #333;">Your Verification Code</h2>
                <h1 style="color: #4A90E2; font-size: 40px; letter-spacing: 5px; margin: 20px 0;">${otp}</h1>
                <p style="color: #666;">This OTP is valid for 5 minutes.</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
            </div>
        `
    });

    return otp;
};

module.exports = sendOTP;
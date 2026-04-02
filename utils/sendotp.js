const { transporter } = require("./mailer");

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (email) => {
    const otp = generateOTP();

    const mailOptions = {
        from: `"FullStack Cafe" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "OTP Verification - FullStack Cafe",
        html: `
            <div style="font-family: sans-serif; text-align: center;">
                <h2>Your Verification Code</h2>
                <h1 style="color: #4A90E2; font-size: 40px; letter-spacing: 5px;">${otp}</h1>
                <p>This OTP is valid for 5 minutes. If you didn't request this, please ignore this email.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
    return otp; // Return the code so the controller can save it in otpStore
};

module.exports = sendOTP;
const tls = require('tls');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

class CafeMailer {
    constructor() {
        this.host = 'smtp.gmail.com';
        this.port = 465; // Using 465 for Direct TLS
        this.user = process.env.EMAIL_USER;
        this.pass = process.env.EMAIL_PASS;
    }

    // Helper to encode strings to Base64 (Required for SMTP Auth)
    toBase64(str) {
        return Buffer.from(str).toString('base64');
    }

    /**
     * Native SMTP Sender using TLS
     */
    async sendRawMail({ to, subject, html }) {
        return new Promise((resolve, reject) => {
            const socket = tls.connect(this.port, this.host, {
                servername: this.host,
                rejectUnauthorized: false
            });

            let step = 0;

            const send = (data) => {
                socket.write(data + '\r\n');
            };

            socket.on('secureConnect', () => {
                console.log("Connected to SMTP Server...");
            });

            socket.on('data', (data) => {
                const response = data.toString();
                // console.log('S:', response); // Debug server responses

                if (response.startsWith('220') && step === 0) {
                    send(`EHLO ${this.host}`);
                    step++;
                } else if (response.startsWith('250') && step === 1) {
                    send('AUTH LOGIN');
                    step++;
                } else if (response.startsWith('334') && step === 2) {
                    send(this.toBase64(this.user));
                    step++;
                } else if (response.startsWith('334') && step === 3) {
                    send(this.toBase64(this.pass));
                    step++;
                } else if (response.startsWith('235') && step === 4) {
                    send(`MAIL FROM:<${this.user}>`);
                    step++;
                } else if (response.startsWith('250') && step === 5) {
                    send(`RCPT TO:<${to}>`);
                    step++;
                } else if (response.startsWith('250') && step === 6) {
                    send('DATA');
                    step++;
                } else if (response.startsWith('354') && step === 7) {
                    const message = [
                        `From: "FullStack Cafe" <${this.user}>`,
                        `To: ${to}`,
                        `Subject: ${subject}`,
                        'Content-Type: text/html; charset=utf-8',
                        '',
                        html,
                        '.'
                    ].join('\r\n');
                    send(message);
                    step++;
                } else if (response.startsWith('250') && step === 8) {
                    send('QUIT');
                    console.log(`📧 Native Mail Sent to: ${to}`);
                    resolve(true);
                }
            });

            socket.on('error', (err) => {
                console.error("Native Mailer Error:", err);
                reject(err);
            });
        });
    }

    async sendOTP(email, otp) {
        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #5d4037;">FullStack Cafe</h2>
                <p>Your code: <strong style="color: #ff6f00; font-size: 20px;">${otp}</strong></p>
            </div>`;
        return this.sendRawMail({ to: email, subject: 'Verification Code', html });
    }

    async sendMail(options) {
        return this.sendRawMail(options);
    }
}

module.exports = new CafeMailer();
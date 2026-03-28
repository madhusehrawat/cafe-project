const webpush = require('web-push');
//const User = require('../models/userModel')
const User=require('../models/User'); // Updated to match your actual User model file name

webpush.setVapidDetails(
    'mailto:admin@fullstackcafe.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

// Route to save subscription
exports.subscribe = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        
        const subscription = req.body;
        await User.findByIdAndUpdate(req.user._id, { subscription });
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Function to send notification (Call this when order status changes)
exports.sendNotification = async (userId, title, body) => {
    const user = await User.findById(userId);
    if (user && user.subscription) {
        // Wrap title and body into a single object before stringifying
        const payload = JSON.stringify({ 
            title: title, 
            body: body,
            icon: '/images/logo.png' // Matches your sw.js expectation
        });
        
        webpush.sendNotification(user.subscription, payload)
            .catch(err => {
                if (err.statusCode === 410) {
                    console.log("Subscription expired."); // Optional: clear user.subscription
                }
                console.error("Push Error:", err);
            });
    }
};
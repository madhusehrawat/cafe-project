const webpush = require('web-push');

webpush.setVapidDetails(
    'mailto:admin@fullstackcafe.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

// Route to save subscription
exports.subscribe = async (req, res) => {
    const subscription = req.body;
    await User.findByIdAndUpdate(req.user._id, { subscription });
    res.status(201).json({});
};

// Function to send notification (Call this when order status changes)
exports.sendNotification = async (userId, title, body) => {
    const user = await User.findById(userId);
    if (user && user.subscription) {
        const payload = JSON.stringify({ title, body });
        webpush.sendNotification(user.subscription, payload)
            .catch(err => console.error("Push Error:", err));
    }
};
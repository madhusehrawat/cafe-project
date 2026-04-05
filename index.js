const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const webpush = require('web-push');
const cors = require('cors');

// Database & Models
const connectDB = require('./config/db');
const User = require('./models/User');

// Initialize Express
const app = express();

// Connect to MongoDB
connectDB();

// --- WebPush Configuration ---
webpush.setVapidDetails(
    'mailto:admin@fullstackcafe.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
);

// --- Middleware ---
app.use(morgan('dev'));
// Serve static files (sw.js must be in /public to be accessible at root scope)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const corsOptions = {
  origin: process.env.FRONTEND_URL, // Allow your live website to talk to the server
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// View Engine
app.set('view engine', 'ejs');

// Auth Middleware (Global check)
const { checkAuth } = require("./middleware/authMiddleware");
app.use(checkAuth);

// --- Routes ---

/**
 * 1. WebPush Subscription Route
 * Saves the unique browser subscription object to the User document
 */
app.post('/subscribe', async (req, res) => {
    try {
        // Checking for req.user (populated by checkAuth middleware)
        if (!req.user) {
            console.error("❌ No user found in request. Is checkAuth working?");
            return res.status(401).json({ success: false, error: "Login required" });
        }

        const subscription = req.body;
        const userId = req.user._id || req.user.id;

        console.log("Saving subscription for user:", userId);

       const updatedUser = await User.findByIdAndUpdate(
    userId,
    { pushSubscription: subscription },
    { returnDocument: 'after' } // ✅ Use this
);

        if (updatedUser) {
            console.log("✅ Subscription saved successfully for:", updatedUser.email);
            res.status(201).json({ success: true });
        } else {
            res.status(404).json({ success: false, error: "User not found" });
        }
    } catch (err) {
        console.error("❌ Subscription Error:", err);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.post('/admin/broadcast', async (req, res) => {
    const { title, message, url } = req.body;

    try {
        // Find all users where pushSubscription field IS NOT null/empty
        const usersWithSub = await User.find({ 
            pushSubscription: { $exists: true, $ne: null } 
        });

        if (usersWithSub.length === 0) {
            return res.json({ 
                success: false, 
                message: "No subscribed users found in the database." 
            });
        }

        const payload = JSON.stringify({ title, message, url });

        // Loop through users and send the notification
        const broadcastPromises = usersWithSub.map(user => {
            return webpush.sendNotification(user.pushSubscription, payload)
                .catch(async (err) => {
                    // If the subscription is expired (404/410), clean it up
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        await User.findByIdAndUpdate(user._id, { $unset: { pushSubscription: 1 } });
                    }
                });
        });

        await Promise.all(broadcastPromises);
        res.json({ success: true, message: `Broadcast sent to ${usersWithSub.length} users.` });

    } catch (err) {
        console.error("Broadcast Error:", err);
        res.status(500).json({ success: false, message: "Server error during broadcast." });
    }
});

// 2. App Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const supportRoutes = require("./routes/supportRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require('./routes/adminRoutes');

app.get("/", (req, res) => res.redirect("/products"));
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use("/support", supportRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);

// 3. Admin Routes
app.use('/admin', adminRoutes);
app.get('/admin', (req, res) => res.redirect('/admin/dashboard'));

// 4. Utility Routes
app.get('/favicon.ico', (req, res) => res.status(204));

// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { message: "Something went wrong on our end!" });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // Note: Use your local IP for mobile testing
});
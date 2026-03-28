const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const webpush = require('web-push');

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
// Serve static files (Crucial for sw.js to be accessible at /sw.js)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// View Engine
app.set('view engine', 'ejs');

// Auth Middleware (Global check)
const { checkAuth } = require("./middleware/authMiddleware");
app.use(checkAuth);

// --- Routes ---

// 1. WebPush Subscription Route (The "Handshake")
app.post('/subscribe', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: "Login required" });
        
        const subscription = req.body;
        
        // Save the subscription object to the User model
        await User.findByIdAndUpdate(req.user._id, {
            pushSubscription: subscription
        });
        
        res.status(201).json({ success: true });
    } catch (err) {
        console.error("Subscription Error:", err);
        res.status(500).json({ success: false });
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

// --- Error Handling (Optional but recommended) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { message: "Something went wrong on our end!" });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://10.191.74.218:${PORT}`);
});
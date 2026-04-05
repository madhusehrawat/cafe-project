const webpush = require("web-push");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Feedback = require("../models/Feedback"); 


/**
 * Helper: Calculates business metrics
 */
const calculateStats = (orders = [], products = [], feedbacks = []) => {
    // 1. Revenue: Only count 'Delivered' orders
    const totalRevenue = (orders || [])
        .filter(order => order.status && order.status.toLowerCase() === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);

    // 2. Active Orders: Filter for non-final states
    const activeStatuses = ['pending', 'preparing', 'out for delivery'];
    const activeOrders = (orders || []).filter(o => 
        o.status && activeStatuses.includes(o.status.toLowerCase())
    ).length;

    // 3. Low Stock: Threshold of 3 or less
    const lowStockCount = (products || []).filter(p => p.countInStock <= 3).length;

    // 4. Feedback Count
    const totalFeedbacks = (feedbacks || []).length;

    return {
        totalRevenue: totalRevenue.toFixed(2),
        orderCount: (orders || []).length,
        activeOrders: activeOrders,
        lowStockCount: lowStockCount,
        feedbackCount: totalFeedbacks // New property for your dashboard
    };
};


exports.broadcastNotification = async (req, res) => {
    try {
        const { title, message, url } = req.body;

        // 1. Fetch only users who have a push subscription
        const users = await User.find({ subscription: { $exists: true, $ne: null } });

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "No subscribed users found." });
        }

        const payload = JSON.stringify({
            title: title || "FullStack Cafe Update",
            body: message || "Check out our latest treats!",
            icon: '/img/logo.png', // Update to your logo path
            data: { url: url || '/' }
        });

        // 2. Map through users and send notifications
        const notifications = users.map(user => {
            return webpush.sendNotification(user.subscription, payload)
                .catch(async (err) => {
                    // 3. Clean up expired/invalid subscriptions (404 or 410)
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        console.log(`Removing expired subscription for user: ${user._id}`);
                        await User.findByIdAndUpdate(user._id, { $unset: { subscription: 1 } });
                    }
                });
        });

        await Promise.all(notifications);

        res.json({ 
            success: true, 
            message: `Broadcast sent to ${users.length} users successfully.` 
        });

    } catch (err) {
        console.error("Broadcast Error:", err);
        res.status(500).json({ success: false, message: "Server error during broadcast." });
    }
};

// 1. Initial Page Render
exports.getAdminDashboard = async (req, res) => {
    try {
        const [orders, products, feedbacks] = await Promise.all([
            Order.find().populate("user", "username email").sort({ createdAt: -1 }).lean(),
            Product.find().sort({ category: 1, name: 1 }).lean(),
            Feedback.find().sort({ createdAt: -1 }).lean() // Updated to Feedback model
        ]);

        const stats = calculateStats(orders, products,feedbacks);

        res.render("admin/dashboard", { 
            user: req.user, 
            orders, 
            products, 
            feedbacks, // Updated variable name for EJS
            stats,
            publicVapidKey: process.env.PUBLIC_VAPID_KEY
        });
    } catch (err) {
        console.error("Dashboard Load Error:", err);
        res.status(500).send("Internal Server Error");
    }
};

// 2. AJAX Endpoint for Stats Refresh
exports.getDashboardData = async (req, res) => {
    try {
        // 1. Fetch all data in parallel for speed
        const [orders, products, feedbacks] = await Promise.all([
            Order.find().populate('user', 'username').sort({ createdAt: -1 }).lean(),
            Product.find().lean(),
            Feedback.find().sort({ createdAt: -1 }).lean()
        ]);

        // 2. Calculate stats using the helper function we refined
        // Ensure feedbacks is passed so stats.feedbackCount works
        const stats = calculateStats(orders, products, feedbacks);

        // 3. Send EVERYTHING back to the frontend
        res.json({ 
            success: true, 
            stats,     // For the top 4 cards
            orders,    // For the Orders table .map()
            products,  // For the Menu table .map()
            feedbacks  // For the Feedback grid .map()
        });
        
    } catch (err) {
        console.error("Dashboard Data Fetch Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch live dashboard data" 
        });
    }
};

// 3. Update Order Status + WebPush Notification
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    // 1. Update order and populate user to get their subscription
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    ).populate("user");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // 2. Check if the user exists and has an active subscription
    if (order.user && order.user.pushSubscription) {
      // We wrap the URL in a 'data' object so sw.js can read it for 'notificationclick'
      const payload = JSON.stringify({
        title: "Order Update! 🍔",
        body: `Hey ${order.user.username}, your order status is now: ${status}`,
        icon: "/icons/favicon.png",
        data: {
          url: "/orders", // This allows the user to click the notification to see details
        },
      });

      webpush
        .sendNotification(order.user.pushSubscription, payload)
        .catch((err) => {
          console.error("Push Notification Failed:", err);
          // If the endpoint is no longer valid (expired), consider nullifying it
          if (err.statusCode === 410 || err.statusCode === 404) {
            order.user.pushSubscription = null;
            order.user.save();
          }
        });
    }

    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to update status: " + err.message });
  }
};

// 4. Update Any Product Field (Name, Price, etc.)
exports.updateProductField = async (req, res) => {
    try {
        const { productId, field, value } = req.body;
        let updateValue = value;

        if (field === 'price' || field === 'countInStock') {
            updateValue = Number(value);
        }

        const product = await Product.findByIdAndUpdate(productId, { [field]: updateValue }, { returnDocument: 'after' });

        res.json({ success: true, message: `${field} updated`, product });
    } catch (err) {
        res.status(500).json({ success: false, message: "Update failed" });
    }
};

// 5. Toggle Product Visibility
exports.toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        product.isActive = !product.isActive; 
        await product.save();
        res.json({ success: true, isActive: product.isActive });
    } catch (err) {
        res.status(500).json({ success: false });
    }
}

// 6. Delete Feedback
exports.deleteFeedback = async (req, res) => {
    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id);

        // Check if the feedback actually existed
        if (!deletedFeedback) {
            return res.status(404).json({ 
                success: false, 
                message: "Feedback not found or already deleted" 
            });
        }

        res.json({ success: true, message: "Feedback removed" });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ success: false, message: "Server error during deletion" });
    }
};
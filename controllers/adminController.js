const webpush = require("web-push");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Feedback = require("../models/Feedback"); 


/**
 * Helper: Calculates business metrics
 */
const calculateStats = (orders, products) => {
    // Only count delivered orders for revenue
    const totalRevenue = orders
        .filter(order => order.status && order.status.toLowerCase() === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);

    const activeStatuses = ['pending', 'preparing', 'out for delivery'];
    const activeOrders = orders.filter(o => 
        o.status && activeStatuses.includes(o.status.toLowerCase())
    ).length;

    const lowStockCount = products.filter(p => p.countInStock <= 3).length;

    return {
        totalRevenue: totalRevenue.toFixed(2), // Clean number for frontend
        orderCount: orders.length,
        activeOrders: activeOrders,
        lowStockCount: lowStockCount 
    };
};

// 1. Initial Page Render
exports.getAdminDashboard = async (req, res) => {
    try {
        const [orders, products, feedbacks] = await Promise.all([
            Order.find().populate("user", "username email").sort({ createdAt: -1 }).lean(),
            Product.find().sort({ category: 1, name: 1 }).lean(),
            Feedback.find().sort({ createdAt: -1 }).lean() // Updated to Feedback model
        ]);

        const stats = calculateStats(orders, products);

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
        const [orders, products] = await Promise.all([
            Order.find().lean(),
            Product.find().lean()
        ]);
        const stats = calculateStats(orders, products);
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false });
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
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Feedback = require("../models/Feedback"); 
const { sendNotification } = require('./notificationController');

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
        
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId, 
            { status: status }, 
            { new: true }
        ).populate("user");

        if (!updatedOrder) return res.status(404).json({ success: false, message: "Order not found" });

        // WebPush Notification Trigger
        // Sends notification to the CUSTOMER when status changes
        if (updatedOrder.user) {
            const title = `Order Update: ${status}`;
            const body = `Your order #${orderId.toString().slice(-6)} is now ${status}.`;
            
            // This assumes your notificationController handles the web-push logic
            sendNotification(updatedOrder.user._id, title, body);
        }

        res.json({ success: true, message: "Status updated", status: updatedOrder.status });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
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

        const product = await Product.findByIdAndUpdate(
            productId,
            { [field]: updateValue },
            { new: true }
        );

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
        await Feedback.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Feedback removed" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Delete failed" });
    }
};
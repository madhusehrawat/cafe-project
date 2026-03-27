const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

/**
 * Helper: Calculates business metrics from order data.
 */
const calculateStats = (orders, products) => {
    const totalRevenue = orders
        .filter(order => order.status && order.status.toLowerCase() === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);

    const activeStatuses = ['pending', 'preparing', 'out for delivery'];
    const activeOrders = orders.filter(o => 
        o.status && activeStatuses.includes(o.status.toLowerCase())
    ).length;

    // ✅ Track how many items are out of stock or low (e.g., less than 3)
    const lowStockCount = products.filter(p => p.countInStock <= 3).length;

    return {
        totalRevenue: totalRevenue.toLocaleString('en-IN', { 
            style: 'currency', 
            currency: 'INR',
            minimumFractionDigits: 2 
        }),
        orderCount: orders.length,
        activeOrders: activeOrders,
        lowStockCount: lowStockCount 
    };
};

// 1. Initial Page Render
exports.getAdminDashboard = async (req, res) => {
    try {
        const [orders, products] = await Promise.all([
            Order.find()
                .populate("user", "username email")
                .sort({ createdAt: -1 })
                .lean(),
            Product.find().sort({ category: 1, name: 1 }).lean()
        ]);

        const stats = calculateStats(orders, products);

        res.render("admin/dashboard", { 
            user: req.user, 
            orders, 
            products, 
            stats ,
            publicVapidKey: process.env.PUBLIC_VAPID_KEY
        });
    } catch (err) {
        console.error("Dashboard Load Error:", err);
        res.status(500).render("error", { message: "Failed to load admin dashboard" });
    }
};

// 2. AJAX Endpoint for Auto-Refresh (Polling)
exports.getDashboardData = async (req, res) => {
    try {
        const [orders, products] = await Promise.all([
            Order.find().populate("user", "username email").sort({ createdAt: -1 }).lean(),
            Product.find().lean()
        ]);

        const stats = calculateStats(orders, products);

        res.json({ 
            success: true, 
            orders, 
            products, // Included products so stock levels update live
            stats,
            lastUpdated: new Date().toISOString() 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error during data fetch" });
    }
};

// 3. Update Order Status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId, 
            { status: status }, 
            { new: true, runValidators: true }
        );
        const { sendNotification } = require('./notificationController');

    if (newStatus === 'Out for Delivery') {
    sendNotification(order.userId, 'Order on the Way!', 'Your FullStack Cafe treat is heading to you.');
}
        if (!updatedOrder) return res.status(404).json({ success: false, message: "Order not found" });

        res.json({ success: true, message: "Status updated", status: updatedOrder.status });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
};

// 4. Toggle Product Visibility (isActive)
exports.toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        product.isActive = !product.isActive; 
        await product.save();
        
        res.json({ 
            success: true, 
            isActive: product.isActive,
            message: `Product ${product.isActive ? 'Visible' : 'Hidden'}` 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Toggle error" });
    }
};

// 5. Update Stock Quantity (NEW)
// This allows the admin to type a number like "50" to restock an item
exports.updateProductStock = async (req, res) => {
    try {
        const { productId, newStock } = req.body;
        
        const product = await Product.findByIdAndUpdate(
            productId,
            { countInStock: Number(newStock) },
            { new: true }
        );

        res.json({ 
            success: true, 
            message: "Stock updated", 
            countInStock: product.countInStock 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update stock" });
    }
};
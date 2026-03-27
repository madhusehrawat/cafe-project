const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const { sendNotification } = require('./notificationController');


/**
 * 1. Admin: Get Dashboard (The page itself)
 * FIX: Wrapped stats into an object to match EJS expectations
 */
exports.getAdminDashboard = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user')
            .sort({ createdAt: -1 })
            .lean() || [];

        const products = await Product.find().sort({ name: 1 }).lean() || [];

        // Calculate Revenue
        const totalRevenue = orders
            .filter(o => o && o.status === 'Delivered')
            .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

        // Calculate Active Orders
        const activeOrdersCount = orders.filter(o => 
            o && !['Delivered', 'Cancelled'].includes(o.status)
        ).length;

        // Calculate Low Stock
        const lowStockCount = products.filter(p => p && (Number(p.countInStock) || 0) <= 5).length;

        // Group into a stats object for the EJS template
        const stats = {
            totalRevenue: totalRevenue.toFixed(2),
            activeOrders: activeOrdersCount,
            lowStockCount: lowStockCount,
            orderCount: orders.length
        };

        res.render("admin/dashboard", { 
            orders, 
            products,
            stats, // This must be passed as an object
            user: req.user || {} 
        });
    } catch (err) {
        console.error("Dashboard Load Error:", err);
        res.status(500).send(`<h1>Dashboard Error</h1><pre>${err.stack}</pre>`);
    }
};

/**
 * 2. Admin: Get Dashboard Data (For AJAX Sync)
 */
exports.getDashboardData = async (req, res) => {
    try {
        const orders = await Order.find().lean() || [];
        const products = await Product.find().lean() || [];

        const totalRevenue = orders
            .filter(o => o && o.status === 'Delivered')
            .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

        res.json({
            success: true,
            lastUpdated: new Date().toLocaleTimeString(),
            stats: {
                totalRevenue: totalRevenue.toFixed(2),
                activeOrders: orders.filter(o => o && !['Delivered', 'Cancelled'].includes(o.status)).length,
                lowStockCount: products.filter(p => p && (Number(p.countInStock) || 0) <= 5).length,
                orderCount: orders.length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Sync failed" });
    }
};


/**
 * 3. User: Get My Orders
 */
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate("items.productId") // Keeps UI reactive even if product data changes
            .sort({ createdAt: -1 })
            .lean();

        res.render("orders", { orders: orders || [], user: req.user });
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).send("Internal Server Error");
    }
};

/**
 * 4. User/Admin: Get Order Status (SECURED)
 */
exports.getOrderStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // Security Check: Only the owner or an admin can see this
        if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        res.json({ success: true, status: order.status });
    } catch (err) {
        res.status(500).json({ success: false, error: "Database error" });
    }
};

/**
 * 5. Handle Reorder (IMPROVED Stock Validation)
 */


exports.handleReorder = async (req, res) => {
    try {
        const orderId = req.params.id;

        // 1. Find the old order and get current product info from the database
        const oldOrder = await Order.findOne({ 
            _id: orderId, 
            user: req.user._id 
        }).populate('items.productId');

        if (!oldOrder) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // 2. Map the items to match your CART structure
        const validItems = oldOrder.items
            .filter(item => item.productId && item.productId.isActive !== false)
            .map(item => {
                return {
                    // This must match the keys you use in your Cart/Products page
                    productId: item.productId._id, 
                    name: item.productId.name,
                    price: item.productId.price,
                    image: item.productId.image,
                    quantity: item.quantity
                };
            });

        if (validItems.length === 0) {
            return res.status(400).json({ success: false, message: "Products are no longer available." });
        }

        // 3. Send the clean array to the frontend
        res.json({ 
            success: true, 
            items: validItems 
        });

    } catch (err) {
        console.error("Reorder Error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};
/**
 * 7. Admin: Update Order Status & Stock + PUSH NOTIFICATIONS
 */
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        
        // Populate 'user' so we can access their subscription details
        const order = await Order.findById(orderId).populate('user');
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });

        const oldStatus = (order.status || "").toLowerCase();
        const newStatus = (status || "").toLowerCase();

        // --- 1. STOCK LOGIC ---
        // DEDUCT STOCK: Moving from Pending to an active state
        if (oldStatus === 'pending' && ['preparing', 'out for delivery', 'delivered'].includes(newStatus)) {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { countInStock: -item.quantity } });
            }
        }

        // RESTORE STOCK: Moving from active state back to Cancelled or Pending
        if (['preparing', 'out for delivery', 'delivered'].includes(oldStatus) && (newStatus === 'cancelled' || newStatus === 'pending')) {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { countInStock: item.quantity } });
            }
        }

        // --- 2. UPDATE DATABASE ---
        order.status = status; 
        await order.save();

        // --- 3. PUSH NOTIFICATION LOGIC ---
        // Only send if the status actually changed and the user exists
        if (oldStatus !== newStatus && order.user) {
            let message = "";
            
            switch(newStatus) {
                case 'preparing':
                    message = "Your delicious order is now being prepared! ☕";
                    break;
                case 'out for delivery':
                    message = "Get ready! Your order is on its way to you. 🛵";
                    break;
                case 'delivered':
                    message = "Enjoy your meal! Your order has been delivered. ✅";
                    break;
                case 'cancelled':
                    message = "Your order has been cancelled. Please contact us for details.";
                    break;
            }

            if (message) {
                // Call the helper from your notificationController
                // Pass the user ID, Title, and the Message body
                sendNotification(
                    order.user._id, 
                    "Order Update - FullStack Cafe", 
                    message
                ).catch(err => console.error("Notification trigger failed:", err));
            }
        }

        res.status(200).json({ success: true, message: `Status updated to ${status}` });
    } catch (err) {
        console.error("Order Update Error:", err);
        res.status(500).json({ success: false, message: "Failed to update order status." });
    }
};
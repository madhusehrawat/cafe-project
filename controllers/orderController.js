const webpush = require("web-push");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const User = require("../models/User");


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
 *  User/Admin: Get Order Status (SECURED)
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
/**
 * 7. Admin: Update Order Status & Stock + PUSH NOTIFICATIONS
 */
// exports.updateOrderStatus = async (req, res) => {
//     try {
//         const { orderId, status } = req.body;
        
//         // Populate 'user' to get the pushSubscription object
//         const order = await Order.findById(orderId).populate('user');
//         if (!order) return res.status(404).json({ success: false, message: "Order not found." });

//         const oldStatus = (order.status || "").toLowerCase();
//         const newStatus = (status || "").toLowerCase();

//         // --- 1. STOCK LOGIC ---
//         if (oldStatus === 'pending' && ['preparing', 'out for delivery', 'delivered'].includes(newStatus)) {
//             for (const item of order.items) {
//                 await Product.findByIdAndUpdate(item.productId, { $inc: { countInStock: -item.quantity } });
//             }
//         }

//         if (['preparing', 'out for delivery', 'delivered'].includes(oldStatus) && (newStatus === 'cancelled' || newStatus === 'pending')) {
//             for (const item of order.items) {
//                 await Product.findByIdAndUpdate(item.productId, { $inc: { countInStock: item.quantity } });
//             }
//         }

//         // --- 2. UPDATE DATABASE ---
//         order.status = status; 
//         await order.save();

//         // --- 3. PUSH NOTIFICATION LOGIC ---
//         if (oldStatus !== newStatus && order.user && order.user.pushSubscription) {
//             let message = "";
//             let title = "Order Update - FullStack Café";
            
//             // Customize message based on status
//             switch(newStatus) {
//                 case 'preparing':
//                     message = "Your delicious order is now being prepared! ☕";
//                     break;
//                 case 'out for delivery':
//                     message = "Get ready! Your order is on its way to you. 🛵";
//                     break;
//                 case 'delivered':
//                     message = "Enjoy your meal! Your order has been delivered. ✅";
//                     break;
//                 case 'cancelled':
//                     message = "Your order has been cancelled. Please contact us for details. ❌";
//                     break;
//                 default:
//                     message = `Your order status has changed to: ${status}`;
//             }

//             // Construct the payload for sw.js
//             const payload = JSON.stringify({
//                 title: title,
//                 body: message,
//                 icon: "/icons/favicon.png",
//                 data: {
//                     url: "/orders" // Directs user to their order history
//                 }
//             });

//             // Send the notification using web-push
//             webpush.sendNotification(order.user.pushSubscription, payload)
//                 .then(() => console.log(`✅ Push sent to user: ${order.user.email}`))
//                 .catch(err => {
//                     console.error("❌ Push Error:", err);
//                     // Cleanup: If subscription is expired (410), remove it from user
//                     if (err.statusCode === 410 || err.statusCode === 404) {
//                         User.findByIdAndUpdate(order.user._id, { $unset: { pushSubscription: 1 } }).exec();
//                     }
//                 });
//         }

//         res.status(200).json({ success: true, message: `Status updated to ${status}` });
//     } catch (err) {
//         console.error("Order Update Error:", err);
//         res.status(500).json({ success: false, message: "Failed to update order status." });
//     }
// };
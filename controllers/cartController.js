const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// 1. Renders the cart page shell
exports.getCartPage = async (req, res) => {
    res.render("cart", { user: req.user }); 
};

/**
 * 2. Sync Cart Logic
 * Ensures local storage matches the database cart
 */
exports.syncCart = async (req, res) => {
    try {
        const { cartItems } = req.body; 

        const formattedItems = cartItems.map(item => ({
            productId: item.productId || item.id || item._id, 
            name: item.name,
            price: item.price,
            image: item.image,
            quantity: item.quantity
        }));

        let cart = await Cart.findOne({ userId: req.user._id });

        if (cart) {
            cart.items = formattedItems;
            await cart.save();
        } else {
            await Cart.create({ 
                userId: req.user._id, 
                items: formattedItems 
            });
        }

        res.json({ success: true, message: "Cart synced successfully." });
    } catch (err) {
        console.error("Sync Error:", err);
        res.status(500).json({ success: false, message: "Failed to sync cart." });
    }
};

/**
 * 3. Fetch Saved Cart
 */
exports.fetchSavedCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user._id });
        
        if (!cart) {
            return res.json({ success: true, items: [] });
        }

        res.json({ 
            success: true, 
            items: cart.items 
        });
    } catch (err) {
        console.error("Fetch Error:", err);
        res.status(500).json({ success: false, message: "Error fetching cart" });
    }
};

/**
 * 4. Checkout Logic
 * Places the order and validates stock levels + active status
 */
exports.checkout = async (req, res) => {
    try {
        const { items } = req.body; 

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Tray is empty." });
        }

        let subtotal = 0;
        const processedItems = [];

        // --- VALIDATION LOOP ---
        for (const item of items) {
            const targetId = item.productId || item.id || item._id;
            
            if (!targetId) {
                return res.status(400).json({ success: false, message: `Missing ID for ${item.name}` });
            }

            // Updated to check isActive: true
            const product = await Product.findOne({ 
                _id: String(targetId).trim(), 
                isActive: true 
            });
            
            if (!product) {
                console.log(`Product ID [${targetId}] not found or inactive.`);
                return res.status(404).json({ 
                    success: false, 
                    message: `Product ${item.name} is no longer available.` 
                });
            }

            // Check stock level
            if (product.countInStock < item.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Sorry, only ${product.countInStock} units of ${product.name} are available.` 
                });
            }

            // Use database price for security (don't trust frontend price)
            const price = parseFloat(product.price);
            const qty = parseInt(item.quantity);
            subtotal += price * qty;
            
            processedItems.push({
                productId: product._id,
                name: product.name,
                quantity: qty,
                price: price,
                image: product.image 
            });
        }

        const tax = subtotal * 0.05; 
        const totalWithTax = (subtotal + tax).toFixed(2);

        const newOrder = new Order({
            user: req.user._id, 
            items: processedItems,
            totalAmount: parseFloat(totalWithTax),
            status: "Pending" 
        });

        await newOrder.save();
        
        // Clear the Database Cart after successful order
        await Cart.findOneAndDelete({ userId: req.user._id });

        res.status(201).json({ 
            success: true, 
            message: "Order placed successfully!",
            orderId: newOrder._id 
        });

    } catch (err) {
        console.error("Checkout Logic Error:", err);
        res.status(500).json({ success: false, message: "Internal server error during checkout." });
    }
};
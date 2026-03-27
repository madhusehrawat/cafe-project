const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const cartController = require("../controllers/cartController"); 
const { requireAuth } = require("../middleware/authMiddleware");

/**
 * @route   POST /orders/confirm
 * @desc    Convert LocalStorage Cart items into a confirmed Order
 */
router.post("/confirm", requireAuth, cartController.checkout);

/**
 * @route   GET /orders
 * @desc    Get all orders for the logged-in user (Renders order.ejs)
 */
router.get("/", requireAuth, orderController.getMyOrders);

/**
 * @route   GET /orders/status/:id
 * @desc    Get status of a specific order (Used by Polling in order.ejs)
 */
router.get("/status/:id", requireAuth, orderController.getOrderStatus);

/**
 * @route   POST /orders/reorder/:id
 * @desc    Duplicate an old order and add items back to cart
 */
router.post('/reorder/:id', requireAuth, orderController.handleReorder);

module.exports = router;
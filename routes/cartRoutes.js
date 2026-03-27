const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { requireAuth } = require("../middleware/authMiddleware");

/** * 1. View Cart Page
 * Renders the cart.ejs file.
 * The frontend JS will read from LocalStorage and display items.
 */
router.get("/", cartController.getCartPage);

/** * 2. Confirm Order (Checkout)
 * This is the bridge to the database. 
 * It takes the LocalStorage array and saves it as an Order in MongoDB.
 */
router.post("/confirm", requireAuth, cartController.checkout);

/**
 * NOTE: 
 * "protect" was replaced with "requireAuth" to ensure 
 * req.user is available for the checkout logic.
 */

module.exports = router;
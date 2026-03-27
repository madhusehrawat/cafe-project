
const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
//const { checkAuth } = require("../middleware/authMiddleware");

router.get("/products", productController.getProductsPage);


// Only requireAuth for actions like Add to Cart
// router.post("/cart/add", requireAuth, cartController.addToCart);

module.exports = router;
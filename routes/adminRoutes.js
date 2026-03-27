const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { requireAuth } = require("../middleware/authMiddleware");
const productController = require("../controllers/productController");
const multer = require("multer");
const path = require("path");
const fs = require("fs"); // Added to handle folder creation

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = "public/images";
        // Ensure the directory exists to prevent the "Failed to add" error
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        // Creates a unique filename
        cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|avif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error("Only images (jpeg, jpg, png, webp, avif) are allowed"));
    }
});

/**
 * Middleware: restricts access to users with 'admin' role.
 */
const adminOnly = (req, res, next) => {
    try {
        if (req.user && req.user.role === 'admin') {
            return next();
        }
        
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(403).json({ 
                success: false, 
                message: "Access Denied: Admin privileges required." 
            });
        }

        res.status(403).render("error", { 
            message: "Access Denied: Admin privileges required." 
        });
    } catch (err) {
        console.error("Admin Auth Error:", err);
        res.status(500).send("Internal Server Error");
    }
};

// --- Dashboard Routes ---
router.get("/dashboard", adminOnly, adminController.getAdminDashboard);
router.get("/dashboard-data", adminOnly, adminController.getDashboardData);

// --- Product Management ---

// 1. Get the Add Product Page (Admin Only)
router.get('/products/add', adminOnly, productController.getAddProductPage);

// 2. Post New Product (Admin Only + Multer File Upload)
// Note: name="image" in EJS must match here
router.post('/products/add', adminOnly, upload.single('image'), productController.postAddProduct);

// 3. Status Toggles
router.patch("/product/toggle-status/:id", adminOnly, adminController.toggleProductStatus);
router.post("/product/toggle/:id", adminOnly, adminController.toggleProductStatus);
router.patch("/product/update-stock", adminOnly, adminController.updateProductStock);
// --- Order Management ---
router.post("/order/status", adminOnly, adminController.updateOrderStatus);

module.exports = router;
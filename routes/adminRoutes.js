const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const productController = require("../controllers/productController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = "public/images";
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
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
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    
    // Check if it's an AJAX/JSON request
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(403).json({ 
            success: false, 
            message: "Access Denied: Admin privileges required." 
        });
    }

    res.status(403).render("error", { 
        message: "Access Denied: Admin privileges required." 
    });
};

// --- Dashboard & Analytics ---
router.get("/dashboard", adminOnly, adminController.getAdminDashboard);
router.get("/dashboard-data", adminOnly, adminController.getDashboardData);


// --- Product Management ---

// 1. Pages
router.get('/products/add', adminOnly, productController.getAddProductPage);
router.post('/products/add', adminOnly, upload.single('image'), productController.postAddProduct);

// 2. Inline Editing (Updates Name, Price, or Category)
router.patch("/product/update-field", adminOnly, adminController.updateProductField);

// 3. Stock Management
router.patch("/product/update-stock", adminOnly, adminController.updateProductField); // Reuses field logic

// 4. Status & Visibility
router.post("/product/toggle/:id", adminOnly, adminController.toggleProductStatus);

// --- Order Management ---
router.post("/order/status", adminOnly, adminController.updateOrderStatus);

// --- Feedback Hub (Renamed from Support Hub) ---
// Matches the 'deleteFeedback' function in your updated adminController
router.delete("/feedback/delete/:id", adminOnly, adminController.deleteFeedback);


router.post('/broadcast', adminOnly, adminController.broadcastNotification);

module.exports = router;
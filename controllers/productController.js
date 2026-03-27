const Product = require("../models/Product");

// GET /products
exports.getProductsPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8; 
        
        // 1. Capture All Query Parameters
        const search = req.query.search || "";
        const category = req.query.category || "";
        const availability = req.query.availability || ""; 

        // 2. Build the Filter Object
        // We only show products where isActive is true
        let filter = { isActive: true };

        // Search Filter (Case-insensitive)
        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        // Category Filter
        if (category && category !== "") {
            filter.category = category;
        }

        // Availability Logic
        if (availability === "instock") {
            filter.countInStock = { $gt: 0 };
        } else if (availability === "outofstock") {
            filter.countInStock = { $lte: 0 };
        }

        // 3. Database Execution
        const totalItems = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalItems / limit) || 1; // Default to 1 if no items
        
        // Ensure current page doesn't exceed total pages after filtering
        const currentPage = page > totalPages ? totalPages : page;

        const items = await Product.find(filter)
            .sort({ createdAt: -1 }) // Show newest items first
            .skip((currentPage - 1) * limit)
            .limit(limit);

        // 4. Render with all filter states
        res.render("products", {
            items,
            search,
            category,
            availability,
            currentPage,
            totalPages,
            user: req.user || null
        });

    } catch (err) {
        console.error("Error in getProductsPage:", err);
        res.status(500).send("Internal Server Error");
    }
};

// POST /admin/add-product (For reference)
exports.postAddProduct = async (req, res) => {
    try {
        const { name, price, category, description, isActive, countInStock } = req.body;
        const imagePath = req.file ? req.file.filename : 'default-food.png';

        const newProduct = new Product({
            name,
            price: Number(price),
            category,
            description,
            countInStock: Number(countInStock) || 0,
            isActive: isActive === 'on' || isActive === true, 
            image: imagePath 
        });

        await newProduct.save();
        res.redirect('/admin/dashboard?success=product-added');
        
    } catch (err) {
        console.error("Error saving product:", err);
        res.status(500).send("Failed to add product.");
    }
};

exports.getAddProductPage = (req, res) => {
    res.render("admin/addProduct", { user: req.user });
};
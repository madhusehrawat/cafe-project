// controllers/supportController.js

const Feedback = require("../models/Feedback");

// GET support page
exports.getSupportPage = (req, res) => {
    res.render("support", {
        user: req.user || null,
        success: false
    });
};

// POST complaint
exports.submitComplaint = async (req, res) => {
    const { name, email, product, message } = req.body;

    // Validation
    if (!name || !email || !product || !message) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }

    try {
        // Save complaint to the database
        const newComplaint = new Feedback({
            name,
            email,
            product,
            message,
            userId: req.user ? req.user._id : null
        });

        await newComplaint.save();

        // Respond with success
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Error saving complaint:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error. Please try again later."
        });
    }
};
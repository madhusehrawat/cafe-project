const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    description: { 
        type: String 
    },
    price: { 
        type: Number, 
        required: true,
        min: 0
    },
    category: {
        type: String,
        enum: ["coffee", "drinks", "junk food", "salad", "dessert"],
        required: true,
        lowercase: true
    },
    image: { 
        type: String, 
        required: true 
    },
    // ✅ Inventory tracking: 0 means "Sold Out"
    countInStock: {
        type: Number,
        required: true,
        default: 10,
        min: 0
    },
    // ✅ Controls if the product is visible at all on the menu
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, {
    // ✅ This automatically adds createdAt and updatedAt fields
    timestamps: true 
});

module.exports = mongoose.model("Product", productSchema);
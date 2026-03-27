const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Product",
            required: true 
        },
        name: String,   // Changed from productName to match controller: product.name
        image: String,  // Added so the admin can see the item thumbnail
        quantity: { 
            type: Number, 
            required: true,
            min: [1, 'Quantity cannot be less than 1']
        },
        price: { 
            type: Number, 
            required: true 
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        // Matches your Dashboard dropdown values exactly
        enum: ["Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"],
        default: "Pending"
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    
});

module.exports = mongoose.model("Order", orderSchema);
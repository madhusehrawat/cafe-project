const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [{
        productId: String,
        productName: String,
        quantity: Number,
        price: Number,
        image: String
    }]
});

module.exports = mongoose.model("Cart", cartSchema);
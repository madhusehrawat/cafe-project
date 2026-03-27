
const dotenv = require('dotenv');
dotenv.config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const connectDB = require("../config/db");

// Connect to MongoDB
connectDB();

const products = [
    { name: "Black Berry Juice", description: "Freshly squeezed black berry juice.", price: 250, category: "drinks", image: "blackberryjuice.avif" },
    { name: "Blue Berry Choco Cake", description: "Delicious blueberry chocolate cake.", price: 400, category: "dessert", image: "blueberrychocolatecake.avif" },
    { name: "Blue Berry Kulfi", description: "Creamy blueberry kulfi.", price: 150, category: "dessert", image: "blueberrykulfi.avif" },
    { name: "Broccoli Special Salad", description: "Healthy broccoli salad.", price: 500, category: "salad", image: "brocolispecialsalad.avif" },
    { name: "Burger", description: "Classic burger with cheese and veggies.", price: 150, category: "junk food", image: "burger.avif" },
    { name: "Burger with French Fries", description: "Burger combo with crispy fries.", price: 900, category: "junk food", image: "burgerwithfrenchfries.avif" },
    { name: "Chaat", description: "Tangy Indian street food chaat.", price: 250, category: "junk food", image: "chaat.avif" },
    { name: "Chilli Potato", description: "Spicy and crispy chilli potatoes.", price: 170, category: "junk food", image: "chillipotato.avif" },
    { name: "Hot Coffee", description: "Hot and aromatic coffee.", price: 300, category: "coffee", image: "hotcoffee.avif" },
    {name : "Cold Coffee", description: "Refreshing cold coffee.", price: 350, category: "coffee", image: "coldcoffee.avif" },
    {name:"Black Coffee", description:"Strong and bold black coffee.", price: 250, category: "coffee", image: "blackcoffee.avif"},
    { name: "Donut", description: "Sweet glazed donut.", price: 300, category: "dessert", image: "donut.avif" },
    { name: "Dora Cake", description: "Delicious Dora cake for dessert.", price: 550, category: "dessert", image: "doracake.avif" },
    { name: "Egg Sandwich", description: "Protein-rich egg sandwich.", price: 350, category: "junk food", image: "eggsandwitch.avif" },
    { name: "Fruit Salad", description: "Fresh seasonal fruit salad.", price: 100, category: "salad", image: "fruitsalad.avif" },
    { name: "Fruit Sandwich", description: "Sweet fruit sandwich.", price: 120, category: "dessert", image:"fruitsandwitch.avif" },
    { name:"Onion Pasta", description:"Pasta with caramelized onion sauce.", price :600,category:"junk food",image:"onionpasta.avif"},
    { name: "Oreo Shake", description: "Creamy oreo shake.", price: 270, category: "drinks", image: "oreoshake.avif" },
    { name: "Pizza", description: "Classic pizza with cheese and toppings.", price: 310, category: "junk food", image: "pizza.avif" },
    { name: "Pomegranate Special Dish", description: "Special pomegranate dish.", price: 200, category: "salad", image: "pomegrantespecialdish.avif" },
    { name: "Red Cherry Cake", description: "Tasty red cherry cake.", price: 450, category: "dessert", image: "redcherrycake.avif" },
    { name: "Red Velvet Cake", description: "Classic red velvet cake.", price: 550, category: "dessert", image: "redvelvetcake.avif" },
    { name: "Rose Pasta", description: "Creamy rose pasta.", price: 650, category: "junk food", image: "rosepasta.avif" },
    { name: "Special Fruit Salad", description: "Mix of seasonal fruits.", price: 600, category: "salad", image:"specialfruitsalad.avif" },
    { name:"Strawberry Cake", description:"Sweet strawberry cake.", price :400,category:"dessert",image:"strawberrycake.avif"},
    { name:"Steam Momos", description:"Soft and juicy steamed momos.", price :90,category:"junk food",image:"steammomos.avif"},
    { name:"Veg Noodles", description:"Stir-fried vegetable noodles.", price :180,category:"junk food",image:"vegnoodles.avif"},
    { name: "Veg Pasta", description: "Pasta with fresh vegetables.", price: 160, category: "junk food", image: "vegpasta.avif" },
    { name: "Veg Salad", description: "Healthy mixed veg salad.", price: 200, category: "salad", image: "vegsalad.avif" }
];

const seedProducts = async () => {
    try {
        await Product.deleteMany({});
        await Product.insertMany(products);
        console.log("Products seeded successfully!");
        mongoose.connection.close();
    } catch (err) {
        console.error("Seeding error:", err);
        mongoose.connection.close();
    }
};

seedProducts();
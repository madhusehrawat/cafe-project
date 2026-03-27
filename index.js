
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();

const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');


connectDB();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const supportRoutes = require("./routes/supportRoutes");
const cartRoutes = require("./routes/cartRoutes");

const path = require('path');


app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.set('view engine', 'ejs');

const { checkAuth } = require("./middleware/authMiddleware");

app.use(checkAuth);

// routes
app.get("/", (req, res) => res.redirect("/products"));
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use("/support", supportRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", require("./routes/orderRoutes"));
const adminRoutes = require('./routes/adminRoutes');


app.use('/admin', adminRoutes);
app.get('/admin', (req, res) => res.redirect('/admin/dashboard'));
app.get('/favicon.ico', (req, res) => res.status(204));

// start server
app.listen(3000, () => {
    console.log("Cafe Server running on port 3000");
});
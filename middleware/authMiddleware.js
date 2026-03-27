const jwt = require("jsonwebtoken");
const User = require("../models/User");

const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey";

// Use this for pages where login is OPTIONAL (like the Navbar)
exports.checkAuth = async (req, res, next) => {
    const token = req.cookies?.token; // MATCHED: changed from jwt to token
    
    if (!token) {
        res.locals.user = null;
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await User.findById(decoded.id).select("-password");
        req.user = user;
        res.locals.user = user; 
    } catch (err) {
        res.locals.user = null;
        req.user = null;
    }
    next();
};

// Use this for pages that REQUIRE login (like Dashboard)
exports.requireAuth = (req, res, next) => {
    const token = req.cookies.token; // MATCHED: changed from jwt to token
    
    // Prevent browser from caching protected pages
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, SECRET_KEY, async (err, decodedToken) => {
        if (err) {
            console.log("JWT Error:", err.message);
            return res.redirect('/login');
        } else {
            const user = await User.findById(decodedToken.id);
            if (!user) return res.redirect('/login');
            
            req.user = user; 
            res.locals.user = user;
            next();
        }
    });
};
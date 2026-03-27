const express = require("express");
const router = express.Router();
const supportController = require("../controllers/supportController");

// GET: Render the support page
router.get("/", supportController.getSupportPage);

// POST: Submit a complaint
router.post("/", supportController.submitComplaint);

module.exports = router;
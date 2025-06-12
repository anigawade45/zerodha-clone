const express = require("express");
const { body, validationResult } = require("express-validator");
const { HoldingsModel } = require("../models/HoldingsModel");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const holdingValidation = [
    body("name").trim().notEmpty().withMessage("Stock name is required"),
    body("qty").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("avg").isFloat({ min: 0.01 }).withMessage("Average price must be greater than 0"),
    body("price").isFloat({ min: 0.01 }).withMessage("Current price must be greater than 0")
];

// ✅ Add a Holding
router.post("/add", authenticateToken, holdingValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, qty, avg, price } = req.body;
        const userId = req.user.id;

        // Calculate net P&L
        const net = (price - avg) * qty;
        const day = ((price - avg) / avg) * 100;

        // Check if holding already exists
        const existingHolding = await HoldingsModel.findOne({ userId, name });
        if (existingHolding) {
            return res.status(400).json({
                error: "Holding exists",
                message: "You already have a position in this stock"
            });
        }

        const newHolding = new HoldingsModel({
            userId,
            name,
            qty,
            avg,
            price,
            net,
            day,
            lastUpdated: new Date()
        });

        await newHolding.save();

        res.status(201).json({
            message: "Holding added successfully!",
            holding: {
                id: newHolding._id,
                name,
                qty,
                avg,
                price,
                net: net.toFixed(2),
                day: day.toFixed(2)
            }
        });
    } catch (error) {
        console.error("Add Holding Error:", error);
        res.status(500).json({
            error: "Failed to add holding",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get All Holdings for a User
router.get("/", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const holdings = await HoldingsModel.find({ userId })
            .select("-__v")
            .sort({ name: 1 });

        // Calculate portfolio metrics
        const totalInvestment = holdings.reduce((sum, h) => sum + (h.avg * h.qty), 0);
        const currentValue = holdings.reduce((sum, h) => sum + (h.price * h.qty), 0);
        const todaysPnL = holdings.reduce((sum, h) => sum + h.net, 0);
        const totalPnL = currentValue - totalInvestment;

        res.status(200).json({
            holdings,
            metrics: {
                totalInvestment: totalInvestment.toFixed(2),
                currentValue: currentValue.toFixed(2),
                todaysPnL: todaysPnL.toFixed(2),
                totalPnL: totalPnL.toFixed(2),
                totalPnLPercentage: ((totalPnL / totalInvestment) * 100).toFixed(2)
            }
        });
    } catch (error) {
        console.error("Fetch Holdings Error:", error);
        res.status(500).json({
            error: "Failed to fetch holdings",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get Single Holding
router.get("/:holdingId", authenticateToken, async (req, res) => {
    try {
        const holding = await HoldingsModel.findOne({
            _id: req.params.holdingId,
            userId: req.user.id
        }).select("-__v");

        if (!holding) {
            return res.status(404).json({
                error: "Holding not found",
                message: "The requested holding does not exist"
            });
        }

        res.status(200).json(holding);
    } catch (error) {
        console.error("Fetch Holding Error:", error);
        res.status(500).json({
            error: "Failed to fetch holding",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Update Holding
router.put("/:holdingId", authenticateToken, holdingValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const holding = await HoldingsModel.findOne({
            _id: req.params.holdingId,
            userId: req.user.id
        });

        if (!holding) {
            return res.status(404).json({
                error: "Holding not found",
                message: "The requested holding does not exist"
            });
        }

        const { qty, avg, price } = req.body;

        // Update fields
        holding.qty = qty;
        holding.avg = avg;
        holding.price = price;
        holding.net = (price - avg) * qty;
        holding.day = ((price - avg) / avg) * 100;
        holding.lastUpdated = new Date();

        await holding.save();

        res.status(200).json({
            message: "Holding updated successfully",
            holding: {
                id: holding._id,
                name: holding.name,
                qty: holding.qty,
                avg: holding.avg,
                price: holding.price,
                net: holding.net.toFixed(2),
                day: holding.day.toFixed(2)
            }
        });
    } catch (error) {
        console.error("Update Holding Error:", error);
        res.status(500).json({
            error: "Failed to update holding",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Delete a Holding
router.delete("/:holdingId", authenticateToken, async (req, res) => {
    try {
        const holding = await HoldingsModel.findOne({
            _id: req.params.holdingId,
            userId: req.user.id
        });

        if (!holding) {
            return res.status(404).json({
                error: "Holding not found",
                message: "The requested holding does not exist"
            });
        }

        await holding.deleteOne();

        res.status(200).json({
            message: "Holding deleted successfully",
            holding: {
                id: holding._id,
                name: holding.name
            }
        });
    } catch (error) {
        console.error("Delete Holding Error:", error);
        res.status(500).json({
            error: "Failed to delete holding",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Bulk Update Holdings Prices
router.post("/bulk-update", authenticateToken, async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!Array.isArray(updates)) {
            return res.status(400).json({
                error: "Invalid request",
                message: "Updates must be an array"
            });
        }

        const userId = req.user.id;
        const bulkOps = [];
        const errors = [];

        for (const update of updates) {
            const { holdingId, price } = update;
            
            if (!holdingId || !price) {
                errors.push(`Invalid update data for holding: ${holdingId}`);
                continue;
            }

            const holding = await HoldingsModel.findOne({ _id: holdingId, userId });
            if (!holding) {
                errors.push(`Holding not found: ${holdingId}`);
                continue;
            }

            const net = (price - holding.avg) * holding.qty;
            const day = ((price - holding.avg) / holding.avg) * 100;

            bulkOps.push({
                updateOne: {
                    filter: { _id: holdingId, userId },
                    update: {
                        $set: {
                            price,
                            net,
                            day,
                            lastUpdated: new Date()
                        }
                    }
                }
            });
        }

        if (bulkOps.length > 0) {
            await HoldingsModel.bulkWrite(bulkOps);
        }

        res.status(200).json({
            message: "Holdings updated successfully",
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Bulk Update Error:", error);
        res.status(500).json({
            error: "Failed to update holdings",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

module.exports = router;

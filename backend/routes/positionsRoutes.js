const express = require("express");
const { body, validationResult } = require("express-validator");
const { PositionsModel } = require("../models/PositionsModel");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const positionValidation = [
    body("product").isIn(["CNC", "MIS", "NRML"]).withMessage("Invalid product type"),
    body("name").trim().notEmpty().withMessage("Stock name is required"),
    body("qty").isInt().withMessage("Quantity must be an integer"),
    body("avg").isFloat({ min: 0.01 }).withMessage("Average price must be greater than 0"),
    body("price").isFloat({ min: 0.01 }).withMessage("Current price must be greater than 0")
];

// ✅ Get all positions for a user
router.get("/", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const positions = await PositionsModel.find({ userId })
            .select("-__v")
            .sort({ name: 1 });

        // Calculate day's metrics
        const totalInvestment = positions.reduce((sum, p) => sum + (p.avg * Math.abs(p.qty)), 0);
        const currentValue = positions.reduce((sum, p) => sum + (p.price * Math.abs(p.qty)), 0);
        const dayPnL = positions.reduce((sum, p) => sum + p.net, 0);
        const totalPnL = currentValue - totalInvestment;

        res.json({
            positions,
            metrics: {
                totalInvestment: totalInvestment.toFixed(2),
                currentValue: currentValue.toFixed(2),
                dayPnL: dayPnL.toFixed(2),
                totalPnL: totalPnL.toFixed(2),
                totalPnLPercentage: ((totalPnL / totalInvestment) * 100).toFixed(2)
            }
        });
    } catch (error) {
        console.error("Fetch Positions Error:", error);
        res.status(500).json({
            error: "Failed to fetch positions",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get positions by product type
router.get("/product/:type", authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const userId = req.user.id;

        if (!["CNC", "MIS", "NRML"].includes(type.toUpperCase())) {
            return res.status(400).json({
                error: "Invalid product type",
                message: "Product type must be CNC, MIS, or NRML"
            });
        }

        const positions = await PositionsModel.find({
            userId,
            product: type.toUpperCase()
        }).select("-__v");

        const metrics = positions.reduce((acc, pos) => {
            acc.totalInvestment += pos.avg * Math.abs(pos.qty);
            acc.currentValue += pos.price * Math.abs(pos.qty);
            acc.dayPnL += pos.net;
            return acc;
        }, { totalInvestment: 0, currentValue: 0, dayPnL: 0 });

        metrics.totalPnL = metrics.currentValue - metrics.totalInvestment;
        metrics.totalPnLPercentage = (metrics.totalPnL / metrics.totalInvestment) * 100;

        res.json({
            positions,
            metrics: {
                totalInvestment: metrics.totalInvestment.toFixed(2),
                currentValue: metrics.currentValue.toFixed(2),
                dayPnL: metrics.dayPnL.toFixed(2),
                totalPnL: metrics.totalPnL.toFixed(2),
                totalPnLPercentage: metrics.totalPnLPercentage.toFixed(2)
            }
        });
    } catch (error) {
        console.error("Fetch Positions by Product Error:", error);
        res.status(500).json({
            error: "Failed to fetch positions",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get single position
router.get("/:positionId", authenticateToken, async (req, res) => {
    try {
        const position = await PositionsModel.findOne({
            _id: req.params.positionId,
            userId: req.user.id
        }).select("-__v");

        if (!position) {
            return res.status(404).json({
                error: "Position not found",
                message: "The requested position does not exist"
            });
        }

        res.json(position);
    } catch (error) {
        console.error("Fetch Position Error:", error);
        res.status(500).json({
            error: "Failed to fetch position",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Add a new position
router.post("/add", authenticateToken, positionValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { product, name, qty, avg, price } = req.body;
        const userId = req.user.id;

        // Calculate P&L
        const net = (price - avg) * qty;
        const day = ((price - avg) / avg) * 100;
        const isLoss = net < 0;

        // Check for existing position
        const existingPosition = await PositionsModel.findOne({
            userId,
            name,
            product
        });

        if (existingPosition) {
            return res.status(400).json({
                error: "Position exists",
                message: `You already have a ${product} position in ${name}`
            });
        }

        const newPosition = new PositionsModel({
            userId,
            product: product.toUpperCase(),
            name,
            qty,
            avg,
            price,
            net,
            day,
            isLoss,
            lastUpdated: new Date()
        });

        await newPosition.save();

        res.status(201).json({
            message: "Position added successfully",
            position: {
                id: newPosition._id,
                product: newPosition.product,
                name,
                qty,
                avg,
                price,
                net: net.toFixed(2),
                day: day.toFixed(2),
                isLoss
            }
        });
    } catch (error) {
        console.error("Add Position Error:", error);
        res.status(500).json({
            error: "Failed to add position",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Update position
router.put("/:positionId", authenticateToken, positionValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const position = await PositionsModel.findOne({
            _id: req.params.positionId,
            userId: req.user.id
        });

        if (!position) {
            return res.status(404).json({
                error: "Position not found",
                message: "The requested position does not exist"
            });
        }

        const { qty, avg, price } = req.body;

        // Update fields
        position.qty = qty;
        position.avg = avg;
        position.price = price;
        position.net = (price - avg) * qty;
        position.day = ((price - avg) / avg) * 100;
        position.isLoss = position.net < 0;
        position.lastUpdated = new Date();

        await position.save();

        res.status(200).json({
            message: "Position updated successfully",
            position: {
                id: position._id,
                product: position.product,
                name: position.name,
                qty: position.qty,
                avg: position.avg,
                price: position.price,
                net: position.net.toFixed(2),
                day: position.day.toFixed(2),
                isLoss: position.isLoss
            }
        });
    } catch (error) {
        console.error("Update Position Error:", error);
        res.status(500).json({
            error: "Failed to update position",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Delete a position
router.delete("/:positionId", authenticateToken, async (req, res) => {
    try {
        const position = await PositionsModel.findOne({
            _id: req.params.positionId,
            userId: req.user.id
        });

        if (!position) {
            return res.status(404).json({
                error: "Position not found",
                message: "The requested position does not exist"
            });
        }

        await position.deleteOne();

        res.status(200).json({
            message: "Position deleted successfully",
            position: {
                id: position._id,
                name: position.name,
                product: position.product
            }
        });
    } catch (error) {
        console.error("Delete Position Error:", error);
        res.status(500).json({
            error: "Failed to delete position",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Square off position
router.post("/:positionId/square-off", authenticateToken, async (req, res) => {
    try {
        const position = await PositionsModel.findOne({
            _id: req.params.positionId,
            userId: req.user.id
        });

        if (!position) {
            return res.status(404).json({
                error: "Position not found",
                message: "The requested position does not exist"
            });
        }

        // Calculate final P&L
        const finalPnL = position.net;
        const pnlPercentage = position.day;

        // Archive the position or move to a separate collection if needed
        // await PositionHistoryModel.create({ ...position.toObject(), squaredOff: new Date() });

        await position.deleteOne();

        res.status(200).json({
            message: "Position squared off successfully",
            position: {
                id: position._id,
                name: position.name,
                product: position.product,
                finalPnL: finalPnL.toFixed(2),
                pnlPercentage: pnlPercentage.toFixed(2)
            }
        });
    } catch (error) {
        console.error("Square Off Position Error:", error);
        res.status(500).json({
            error: "Failed to square off position",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Bulk Update Positions
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
            const { positionId, price } = update;
            
            if (!positionId || !price) {
                errors.push(`Invalid update data for position: ${positionId}`);
                continue;
            }

            const position = await PositionsModel.findOne({ _id: positionId, userId });
            if (!position) {
                errors.push(`Position not found: ${positionId}`);
                continue;
            }

            const net = (price - position.avg) * position.qty;
            const day = ((price - position.avg) / position.avg) * 100;

            bulkOps.push({
                updateOne: {
                    filter: { _id: positionId, userId },
                    update: {
                        $set: {
                            price,
                            net,
                            day,
                            isLoss: net < 0,
                            lastUpdated: new Date()
                        }
                    }
                }
            });
        }

        if (bulkOps.length > 0) {
            await PositionsModel.bulkWrite(bulkOps);
        }

        res.status(200).json({
            message: "Positions updated successfully",
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Bulk Update Error:", error);
        res.status(500).json({
            error: "Failed to update positions",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

module.exports = router;

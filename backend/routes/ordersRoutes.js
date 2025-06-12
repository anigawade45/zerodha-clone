const express = require("express");
const { body, validationResult } = require("express-validator");
const { OrdersModel } = require("../models/OrdersModel");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const orderValidation = [
    body("name").trim().notEmpty().withMessage("Stock name is required"),
    body("qty").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("price").isFloat({ min: 0.01 }).withMessage("Price must be greater than 0"),
    body("mode").isIn(["BUY", "SELL"]).withMessage("Mode must be either BUY or SELL"),
    body("orderType").isIn(["MARKET", "LIMIT"]).withMessage("Order type must be either MARKET or LIMIT"),
    body("validity").isIn(["DAY", "IOC"]).withMessage("Validity must be either DAY or IOC")
];

// ✅ Place New Order
router.post("/new", authenticateToken, orderValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, qty, price, mode, orderType, validity, triggerPrice } = req.body;
        const userId = req.user.id; // From auth middleware

        // Additional business logic validations
        if (orderType === "LIMIT" && !price) {
            return res.status(400).json({
                error: "Price is required for LIMIT orders",
                message: "Please specify a price for your limit order"
            });
        }

        const newOrder = new OrdersModel({
            userId,
            name,
            qty,
            price,
            mode,
            orderType,
            validity,
            triggerPrice,
            status: "PENDING",
            orderDate: new Date(),
            lastModified: new Date()
        });

        await newOrder.save();

        // TODO: Integrate with order execution system
        // await executeOrder(newOrder);

        res.status(201).json({
            message: "Order placed successfully!",
            order: {
                id: newOrder._id,
                name,
                qty,
                price,
                mode,
                orderType,
                status: newOrder.status
            }
        });
    } catch (error) {
        console.error("Place Order Error:", error);
        res.status(500).json({
            error: "Failed to place order",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get Orders for a User
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { status, mode, date, limit = 50, page = 1 } = req.query;
        const userId = req.user.id;

        const query = { userId };

        // Apply filters
        if (status) query.status = status.toUpperCase();
        if (mode) query.mode = mode.toUpperCase();
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.orderDate = { $gte: startDate, $lte: endDate };
        }

        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            OrdersModel.find(query)
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select("-__v"),
            OrdersModel.countDocuments(query)
        ]);

        res.status(200).json({
            orders,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Fetch Orders Error:", error);
        res.status(500).json({
            error: "Failed to fetch orders",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get Order by ID
router.get("/:orderId", authenticateToken, async (req, res) => {
    try {
        const order = await OrdersModel.findOne({
            _id: req.params.orderId,
            userId: req.user.id
        }).select("-__v");

        if (!order) {
            return res.status(404).json({
                error: "Order not found",
                message: "The requested order does not exist"
            });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error("Fetch Order Error:", error);
        res.status(500).json({
            error: "Failed to fetch order",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Cancel Order
router.post("/:orderId/cancel", authenticateToken, async (req, res) => {
    try {
        const order = await OrdersModel.findOne({
            _id: req.params.orderId,
            userId: req.user.id
        });

        if (!order) {
            return res.status(404).json({
                error: "Order not found",
                message: "The requested order does not exist"
            });
        }

        if (!["PENDING", "OPEN"].includes(order.status)) {
            return res.status(400).json({
                error: "Invalid operation",
                message: `Cannot cancel order in ${order.status} status`
            });
        }

        order.status = "CANCELLED";
        order.lastModified = new Date();
        await order.save();

        res.status(200).json({
            message: "Order cancelled successfully",
            order: {
                id: order._id,
                name: order.name,
                status: order.status
            }
        });
    } catch (error) {
        console.error("Cancel Order Error:", error);
        res.status(500).json({
            error: "Failed to cancel order",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Modify Order
router.put("/:orderId", authenticateToken, orderValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const order = await OrdersModel.findOne({
            _id: req.params.orderId,
            userId: req.user.id
        });

        if (!order) {
            return res.status(404).json({
                error: "Order not found",
                message: "The requested order does not exist"
            });
        }

        if (!["PENDING", "OPEN"].includes(order.status)) {
            return res.status(400).json({
                error: "Invalid operation",
                message: `Cannot modify order in ${order.status} status`
            });
        }

        const { qty, price, validity, triggerPrice } = req.body;

        // Update allowed fields
        order.qty = qty;
        order.price = price;
        order.validity = validity;
        order.triggerPrice = triggerPrice;
        order.lastModified = new Date();

        await order.save();

        res.status(200).json({
            message: "Order modified successfully",
            order: {
                id: order._id,
                name: order.name,
                qty: order.qty,
                price: order.price,
                status: order.status
            }
        });
    } catch (error) {
        console.error("Modify Order Error:", error);
        res.status(500).json({
            error: "Failed to modify order",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

module.exports = router;

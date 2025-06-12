const express = require("express");
const { body, validationResult } = require("express-validator");
const { WatchlistModel } = require("../models/WatchlistModel");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const stockValidation = [
    body("name").trim().notEmpty().withMessage("Stock name is required"),
    body("symbol").trim().notEmpty().withMessage("Stock symbol is required"),
    body("exchange").isIn(["NSE", "BSE"]).withMessage("Exchange must be either NSE or BSE")
];

// Default stocks data
const defaultStocks = [
    {
        symbol: "INFY",
        exchange: "NSE",
        lastPrice: 1555.45,
        change: {
            value: -25.35,
            percentage: -1.60
        }
    },
    {
        symbol: "TCS",
        exchange: "NSE",
        lastPrice: 3194.80,
        change: {
            value: -8.05,
            percentage: -0.25
        }
    },
    {
        symbol: "WIPRO",
        exchange: "NSE",
        lastPrice: 577.75,
        change: {
            value: 1.85,
            percentage: 0.32
        }
    },
    {
        symbol: "RELIANCE",
        exchange: "NSE",
        lastPrice: 2112.40,
        change: {
            value: 30.05,
            percentage: 1.44
        }
    },
    {
        symbol: "HDFCBANK",
        exchange: "NSE",
        lastPrice: 1522.35,
        change: {
            value: 1.65,
            percentage: 0.11
        }
    }
];

// ✅ Get User's Watchlists
router.get("/", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const watchlists = await WatchlistModel.find({ userId })
            .select("-__v")
            .sort({ name: 1 });

        res.status(200).json({
            watchlists: watchlists.map(w => ({
                id: w._id,
                name: w.name,
                stocks: w.stocks,
                stockCount: w.stocks.length,
                lastUpdated: w.lastUpdated
            }))
        });
    } catch (error) {
        console.error("Fetch Watchlists Error:", error);
        res.status(500).json({
            error: "Failed to fetch watchlists",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get Single Watchlist
router.get("/:watchlistId", authenticateToken, async (req, res) => {
    try {
        const watchlist = await WatchlistModel.findOne({
            _id: req.params.watchlistId,
            userId: req.user.id
        }).select("-__v");

        if (!watchlist) {
            return res.status(404).json({
                error: "Watchlist not found",
                message: "The requested watchlist does not exist"
            });
        }

        res.status(200).json(watchlist);
    } catch (error) {
        console.error("Fetch Watchlist Error:", error);
        res.status(500).json({
            error: "Failed to fetch watchlist",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Create New Watchlist
router.post("/create", authenticateToken, [
    body("name").trim().notEmpty().withMessage("Watchlist name is required")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name } = req.body;
        const userId = req.user.id;

        // Check if watchlist with same name exists
        const existingWatchlist = await WatchlistModel.findOne({ userId, name });
        if (existingWatchlist) {
            return res.status(400).json({
                error: "Watchlist exists",
                message: "A watchlist with this name already exists"
            });
        }

        const newWatchlist = new WatchlistModel({
            userId,
            name,
            stocks: [],
            lastUpdated: new Date()
        });

        await newWatchlist.save();

        res.status(201).json({
            message: "Watchlist created successfully",
            watchlist: {
                id: newWatchlist._id,
                name: newWatchlist.name,
                stocks: [],
                stockCount: 0
            }
        });
    } catch (error) {
        console.error("Create Watchlist Error:", error);
        res.status(500).json({
            error: "Failed to create watchlist",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Add Stock to Watchlist
router.post("/:watchlistId/add", authenticateToken, stockValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, symbol, exchange } = req.body;
        const stock = { name, symbol, exchange };
        const userId = req.user.id;

        let watchlist = await WatchlistModel.findOne({
            _id: req.params.watchlistId,
            userId
        });

        if (!watchlist) {
            return res.status(404).json({
                error: "Watchlist not found",
                message: "The requested watchlist does not exist"
            });
        }

        // Check if stock already exists
        const stockExists = watchlist.stocks.some(s => 
            s.symbol === symbol && s.exchange === exchange
        );

        if (stockExists) {
            return res.status(400).json({
                error: "Stock exists",
                message: "This stock is already in your watchlist"
            });
        }

        watchlist.stocks.push(stock);
        watchlist.lastUpdated = new Date();
        await watchlist.save();

        res.status(201).json({
            message: "Stock added to watchlist",
            watchlist: {
                id: watchlist._id,
                name: watchlist.name,
                stocks: watchlist.stocks,
                stockCount: watchlist.stocks.length
            }
        });
    } catch (error) {
        console.error("Add Stock Error:", error);
        res.status(500).json({
            error: "Failed to add stock",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Search Stocks
router.get("/search", authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                error: "Missing query",
                message: "Search query is required"
            });
        }

        // Mock data for demonstration - replace with actual API call
        const mockStocks = [
            { id: "INFY", name: "Infosys Ltd", symbol: "INFY", exchange: "NSE", price: 1450.75 },
            { id: "TCS", name: "Tata Consultancy Services", symbol: "TCS", exchange: "NSE", price: 3250.80 },
            { id: "WIPRO", name: "Wipro Ltd", symbol: "WIPRO", exchange: "NSE", price: 450.25 },
            { id: "HCLTECH", name: "HCL Technologies", symbol: "HCLTECH", exchange: "NSE", price: 1150.90 },
            { id: "TECHM", name: "Tech Mahindra", symbol: "TECHM", exchange: "NSE", price: 1200.45 }
        ];

        // Filter stocks based on search query
        const filteredStocks = mockStocks.filter(stock => 
            stock.name.toLowerCase().includes(q.toLowerCase()) ||
            stock.symbol.toLowerCase().includes(q.toLowerCase())
        );

        res.status(200).json({
            stocks: filteredStocks
        });
    } catch (error) {
        console.error("Search Stocks Error:", error);
        res.status(500).json({
            error: "Failed to search stocks",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Remove Stock from Watchlist
router.delete("/:watchlistId/remove/:symbol", authenticateToken, async (req, res) => {
    try {
        const { watchlistId, symbol } = req.params;
        const userId = req.user.id;

        let watchlist = await WatchlistModel.findOne({
            _id: watchlistId,
            userId
        });

        if (!watchlist) {
            return res.status(404).json({
                error: "Watchlist not found",
                message: "The requested watchlist does not exist"
            });
        }

        // Find and remove the stock
        const stockIndex = watchlist.stocks.findIndex(s => s.symbol === symbol);
        if (stockIndex === -1) {
            return res.status(404).json({
                error: "Stock not found",
                message: "This stock is not in your watchlist"
            });
        }

        watchlist.stocks.splice(stockIndex, 1);
        watchlist.lastUpdated = new Date();
        await watchlist.save();

        res.status(200).json({
            message: "Stock removed successfully",
            watchlist: {
                id: watchlist._id,
                name: watchlist.name,
                stocks: watchlist.stocks,
                stockCount: watchlist.stocks.length
            }
        });
    } catch (error) {
        console.error("Remove Stock Error:", error);
        res.status(500).json({
            error: "Failed to remove stock",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Delete Watchlist
router.delete("/:watchlistId", authenticateToken, async (req, res) => {
    try {
        const watchlist = await WatchlistModel.findOne({
            _id: req.params.watchlistId,
            userId: req.user.id
        });

        if (!watchlist) {
            return res.status(404).json({
                error: "Watchlist not found",
                message: "The requested watchlist does not exist"
            });
        }

        await watchlist.deleteOne();

        res.status(200).json({
            message: "Watchlist deleted successfully",
            watchlist: {
                id: watchlist._id,
                name: watchlist.name
            }
        });
    } catch (error) {
        console.error("Delete Watchlist Error:", error);
        res.status(500).json({
            error: "Failed to delete watchlist",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Reorder Stocks in Watchlist
router.put("/:watchlistId/reorder", authenticateToken, [
    body("stocks").isArray().withMessage("Stocks must be an array")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { stocks } = req.body;
        const userId = req.user.id;

        let watchlist = await WatchlistModel.findOne({
            _id: req.params.watchlistId,
            userId
        });

        if (!watchlist) {
            return res.status(404).json({
                error: "Watchlist not found",
                message: "The requested watchlist does not exist"
            });
        }

        // Validate that all stocks exist
        const currentStocks = new Set(
            watchlist.stocks.map(s => `${s.symbol}:${s.exchange}`)
        );
        const newStocks = new Set(
            stocks.map(s => `${s.symbol}:${s.exchange}`)
        );

        if (currentStocks.size !== newStocks.size) {
            return res.status(400).json({
                error: "Invalid stocks",
                message: "The new order must contain all existing stocks"
            });
        }

        for (const stock of stocks) {
            if (!currentStocks.has(`${stock.symbol}:${stock.exchange}`)) {
                return res.status(400).json({
                    error: "Invalid stock",
                    message: `Stock ${stock.symbol}:${stock.exchange} is not in the watchlist`
                });
            }
        }

        watchlist.stocks = stocks;
        watchlist.lastUpdated = new Date();
        await watchlist.save();

        res.status(200).json({
            message: "Watchlist reordered successfully",
            watchlist: {
                id: watchlist._id,
                name: watchlist.name,
                stocks: watchlist.stocks,
                stockCount: watchlist.stocks.length
            }
        });
    } catch (error) {
        console.error("Reorder Watchlist Error:", error);
        res.status(500).json({
            error: "Failed to reorder watchlist",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Get Default Watchlist
router.get("/default", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const defaultWatchlist = await WatchlistModel.findOne({ 
            userId,
            name: "Default"
        }).select("-__v");

        if (!defaultWatchlist) {
            return res.status(404).json({
                error: "Watchlist not found",
                message: "Default watchlist does not exist"
            });
        }

        res.status(200).json({
            id: defaultWatchlist._id,
            name: defaultWatchlist.name,
            stocks: defaultWatchlist.stocks,
            stockCount: defaultWatchlist.stocks.length,
            lastUpdated: defaultWatchlist.lastUpdated
        });
    } catch (error) {
        console.error("Fetch Default Watchlist Error:", error);
        res.status(500).json({
            error: "Failed to fetch watchlist",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Create Default Watchlist
router.post("/create", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name = "Default" } = req.body;

        // Check if default watchlist exists
        let watchlist = await WatchlistModel.findOne({ userId, name });
        
        if (watchlist) {
            return res.status(200).json({
                message: "Watchlist already exists",
                watchlist: {
                    id: watchlist._id,
                    name: watchlist.name,
                    stocks: watchlist.stocks,
                    stockCount: watchlist.stocks.length
                }
            });
        }

        // Create new default watchlist
        watchlist = new WatchlistModel({
            userId,
            name,
            stocks: [],
            lastUpdated: new Date()
        });

        await watchlist.save();

        res.status(201).json({
            message: "Watchlist created successfully",
            watchlist: {
                id: watchlist._id,
                name: watchlist.name,
                stocks: [],
                stockCount: 0
            }
        });
    } catch (error) {
        console.error("Create Watchlist Error:", error);
        res.status(500).json({
            error: "Failed to create watchlist",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Add Stock to Default Watchlist
router.post("/default/add", authenticateToken, stockValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.id;
        const { stock } = req.body;

        let watchlist = await WatchlistModel.findOne({ 
            userId,
            name: "Default"
        });

        if (!watchlist) {
            watchlist = new WatchlistModel({
                userId,
                name: "Default",
                stocks: [],
                lastUpdated: new Date()
            });
        }

        // Check if stock already exists
        const stockExists = watchlist.stocks.some(s => 
            s.symbol === stock.symbol && s.exchange === stock.exchange
        );

        if (stockExists) {
            return res.status(400).json({
                error: "Stock exists",
                message: "This stock is already in your watchlist"
            });
        }

        watchlist.stocks.push(stock);
        watchlist.lastUpdated = new Date();
        await watchlist.save();

        res.status(201).json({
            message: "Stock added to watchlist",
            watchlist: {
                id: watchlist._id,
                name: watchlist.name,
                stocks: watchlist.stocks,
                stockCount: watchlist.stocks.length
            }
        });
    } catch (error) {
        console.error("Add Stock Error:", error);
        res.status(500).json({
            error: "Failed to add stock",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Remove Stock from Default Watchlist
router.delete("/default/stocks/:symbol", authenticateToken, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { exchange } = req.query;
        const userId = req.user.id;

        if (!exchange) {
            return res.status(400).json({
                error: "Missing parameter",
                message: "Exchange parameter is required"
            });
        }

        let watchlist = await WatchlistModel.findOne({ 
            userId,
            name: "Default"
        });

        if (!watchlist) {
            return res.status(404).json({
                error: "Watchlist not found",
                message: "Default watchlist does not exist"
            });
        }

        const initialLength = watchlist.stocks.length;
        watchlist.stocks = watchlist.stocks.filter(s => 
            !(s.symbol === symbol && s.exchange === exchange)
        );

        if (watchlist.stocks.length === initialLength) {
            return res.status(404).json({
                error: "Stock not found",
                message: "The specified stock was not found in your watchlist"
            });
        }

        watchlist.lastUpdated = new Date();
        await watchlist.save();

        res.status(200).json({
            message: "Stock removed from watchlist",
            watchlist: {
                id: watchlist._id,
                name: watchlist.name,
                stocks: watchlist.stocks,
                stockCount: watchlist.stocks.length
            }
        });
    } catch (error) {
        console.error("Remove Stock Error:", error);
        res.status(500).json({
            error: "Failed to remove stock",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Initialize Default Watchlist
router.post("/initialize", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if user already has a default watchlist
        let defaultWatchlist = await WatchlistModel.findOne({ 
            userId, 
            isDefault: true 
        });

        if (defaultWatchlist) {
            return res.status(400).json({
                error: "Default watchlist exists",
                message: "User already has a default watchlist"
            });
        }

        // Create new default watchlist
        defaultWatchlist = new WatchlistModel({
            userId,
            name: "Default Watchlist",
            description: "Your default watchlist",
            isDefault: true,
            items: defaultStocks,
            color: "#1E88E5",
            icon: "star"
        });

        await defaultWatchlist.save();

        res.status(201).json({
            message: "Default watchlist initialized successfully",
            watchlist: {
                id: defaultWatchlist._id,
                name: defaultWatchlist.name,
                items: defaultWatchlist.items,
                itemsCount: defaultWatchlist.items.length
            }
        });
    } catch (error) {
        console.error("Initialize Watchlist Error:", error);
        res.status(500).json({
            error: "Failed to initialize watchlist",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

module.exports = router;

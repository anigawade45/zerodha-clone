const express = require('express');
const router = express.Router();
const axios = require('axios');

// Fetch market indices data
router.get('/indices', async (req, res) => {
    try {
        // In a real application, you would fetch this data from NSE/BSE APIs
        // For now, we'll return simulated real-time data
        const currentTime = new Date();
        const baseValue = Math.sin(currentTime.getMinutes() / 60 * Math.PI) * 100;
        
        const indices = {
            nifty: {
                value: 19250.75 + baseValue,
                change: (baseValue / 19250.75 * 100).toFixed(2)
            },
            sensex: {
                value: 64382.50 + (baseValue * 2),
                change: (baseValue / 64382.50 * 100).toFixed(2)
            },
            bankNifty: {
                value: 43750.25 + (baseValue * 1.5),
                change: (baseValue / 43750.25 * 100).toFixed(2)
            }
        };

        res.json(indices);
    } catch (error) {
        console.error('Market data error:', error);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

// Fetch stock details
router.get('/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        // In a real application, fetch actual stock data
        // For now, return simulated data
        const mockStockData = {
            symbol,
            price: Math.random() * 1000 + 100,
            change: (Math.random() * 10 - 5).toFixed(2),
            volume: Math.floor(Math.random() * 1000000),
            high: Math.random() * 1000 + 200,
            low: Math.random() * 1000
        };

        res.json(mockStockData);
    } catch (error) {
        console.error('Stock data error:', error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

module.exports = router; 
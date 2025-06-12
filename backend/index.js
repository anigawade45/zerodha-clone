require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");

// Import routes
const userRoutes = require("./routes/userRoutes");
const ordersRoutes = require("./routes/ordersRoutes");
const watchlistRoutes = require("./routes/watchlistRoutes");
const holdingsRoutes = require("./routes/holdingsRoutes");
const positionsRoutes = require("./routes/positionsRoutes");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

// Ensure required environment variables are set
if (!uri) {
    console.error("❌ Missing MONGO_URL in .env file!");
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev")); // Logs API requests

// Connect to MongoDB
mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch((err) => {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    });

// Register API routes
app.use("/users", userRoutes);
app.use("/orders", ordersRoutes);
app.use("/watchlist", watchlistRoutes);
app.use("/holdings", holdingsRoutes);
app.use("/positions", positionsRoutes);

// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: "Server is running!" });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("🔥 Global Error:", err);
    res.status(500).json({ error: "Something went wrong!" });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("🛑 MongoDB disconnected due to app termination");
    process.exit(0);
});

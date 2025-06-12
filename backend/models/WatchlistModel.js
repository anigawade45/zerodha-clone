const mongoose = require("mongoose");
const { WatchlistSchema } = require("../schemas/WatchlistSchema");

const WatchlistModel = mongoose.model("Watchlist", WatchlistSchema, "watchlists");

module.exports = { WatchlistModel };

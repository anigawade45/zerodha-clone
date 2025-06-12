const mongoose = require("mongoose");
const { PositionsSchema } = require("../schemas/PositionsSchema");

const PositionsModel = mongoose.model("Positions", PositionsSchema, "positions"); // Explicit collection name

module.exports = { PositionsModel };

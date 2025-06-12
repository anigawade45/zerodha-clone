const mongoose = require("mongoose");
const { HoldingsSchema } = require("../schemas/HoldingsSchema");

const HoldingsModel = mongoose.model("Holdings", HoldingsSchema, "holdings");

module.exports = { HoldingsModel };

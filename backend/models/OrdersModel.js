const mongoose = require("mongoose");
const { OrdersSchema } = require("../schemas/OrdersSchema");

const OrdersModel = mongoose.model("Orders", OrdersSchema, "orders");

module.exports = { OrdersModel };

const mongoose = require("mongoose");
const { UserSchema } = require("../schemas/UserSchema");

const UserModel = mongoose.model("Users", UserSchema, "users");

module.exports = { UserModel };

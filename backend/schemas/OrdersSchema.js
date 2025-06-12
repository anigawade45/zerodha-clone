const { Schema } = require("mongoose");

const OrdersSchema = new Schema({
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: "Users", 
        required: [true, "User ID is required"],
        index: true
    },
    symbol: { 
        type: String, 
        required: [true, "Stock symbol is required"],
        uppercase: true,
        trim: true
    },
    orderType: {
        type: String,
        required: [true, "Order type is required"],
        enum: ["MARKET", "LIMIT", "SL", "SL-M"],
        default: "MARKET"
    },
    transactionType: {
        type: String,
        required: [true, "Transaction type is required"],
        enum: ["BUY", "SELL"],
        index: true
    },
    product: {
        type: String,
        required: [true, "Product type is required"],
        enum: ["CNC", "MIS", "NRML"],
        default: "CNC"
    },
    quantity: {
        type: Number,
        required: [true, "Quantity is required"],
        min: [1, "Quantity must be at least 1"]
    },
    price: {
        type: Number,
        required: function() {
            return this.orderType === "LIMIT" || this.orderType === "SL";
        },
        min: [0, "Price cannot be negative"]
    },
    triggerPrice: {
        type: Number,
        required: function() {
            return this.orderType === "SL" || this.orderType === "SL-M";
        },
        min: [0, "Trigger price cannot be negative"]
    },
    status: {
        type: String,
        enum: ["PENDING", "EXECUTED", "CANCELLED", "REJECTED"],
        default: "PENDING",
        index: true
    },
    validity: {
        type: String,
        enum: ["DAY", "IOC"],
        default: "DAY"
    },
    exchange: {
        type: String,
        enum: ["NSE", "BSE"],
        required: [true, "Exchange is required"],
        default: "NSE"
    },
    averagePrice: {
        type: Number,
        default: 0
    },
    filledQuantity: {
        type: Number,
        default: 0
    },
    remainingQuantity: {
        type: Number,
        default: function() {
            return this.quantity;
        }
    },
    orderValue: {
        type: Number,
        default: function() {
            return this.price * this.quantity;
        }
    },
    rejectionReason: String,
    tags: [String],
    notes: String,
    parentOrderId: {
        type: Schema.Types.ObjectId,
        ref: "Orders",
        sparse: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
OrdersSchema.index({ userId: 1, createdAt: -1 });
OrdersSchema.index({ status: 1, createdAt: -1 });
OrdersSchema.index({ symbol: 1, createdAt: -1 });

// Virtual for order age
OrdersSchema.virtual('orderAge').get(function() {
    return Math.round((Date.now() - this.createdAt) / 1000);
});

// Pre-save middleware to validate price and trigger price
OrdersSchema.pre('save', function(next) {
    if (this.orderType === "LIMIT" || this.orderType === "SL") {
        if (!this.price) {
            next(new Error("Price is required for LIMIT and SL orders"));
        }
    }
    
    if (this.orderType === "SL" || this.orderType === "SL-M") {
        if (!this.triggerPrice) {
            next(new Error("Trigger price is required for SL and SL-M orders"));
        }
    }

    if (this.orderType === "SL" && this.triggerPrice >= this.price) {
        next(new Error("For SL orders, trigger price must be less than limit price"));
    }

    next();
});

// Method to check if order is modifiable
OrdersSchema.methods.isModifiable = function() {
    return this.status === "PENDING";
};

// Method to calculate order value
OrdersSchema.methods.calculateOrderValue = function() {
    return this.price * this.quantity;
};

module.exports = { OrdersSchema };

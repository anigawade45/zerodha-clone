const { Schema } = require("mongoose");

const PositionsSchema = new Schema({
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
        trim: true,
        index: true
    },
    exchange: {
        type: String,
        enum: ["NSE", "BSE"],
        required: [true, "Exchange is required"],
        default: "NSE"
    },
    product: {
        type: String,
        enum: ["MIS", "NRML", "CNC"],
        required: [true, "Product type is required"]
    },
    quantity: {
        type: Number,
        required: [true, "Quantity is required"],
        validate: {
            validator: Number.isInteger,
            message: "Quantity must be a whole number"
        }
    },
    averagePrice: {
        type: Number,
        required: [true, "Average price is required"],
        min: [0, "Average price cannot be negative"]
    },
    lastTradedPrice: {
        type: Number,
        required: [true, "Last traded price is required"],
        min: [0, "Last traded price cannot be negative"]
    },
    buyQuantity: {
        type: Number,
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: "Buy quantity must be a whole number"
        }
    },
    buyValue: {
        type: Number,
        default: 0,
        min: [0, "Buy value cannot be negative"]
    },
    buyAveragePrice: {
        type: Number,
        default: 0,
        min: [0, "Buy average price cannot be negative"]
    },
    sellQuantity: {
        type: Number,
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: "Sell quantity must be a whole number"
        }
    },
    sellValue: {
        type: Number,
        default: 0,
        min: [0, "Sell value cannot be negative"]
    },
    sellAveragePrice: {
        type: Number,
        default: 0,
        min: [0, "Sell average price cannot be negative"]
    },
    multiplier: {
        type: Number,
        default: 1,
        min: [1, "Multiplier must be at least 1"]
    },
    profitLoss: {
        type: Number,
        default: 0
    },
    realizedProfitLoss: {
        type: Number,
        default: 0
    },
    unrealizedProfitLoss: {
        type: Number,
        default: 0
    },
    dayChange: {
        value: {
            type: Number,
            default: 0
        },
        percentage: {
            type: Number,
            default: 0
        }
    },
    overnight: {
        type: Boolean,
        default: false
    },
    closePrice: {
        type: Number,
        min: [0, "Close price cannot be negative"]
    },
    openPrice: {
        type: Number,
        min: [0, "Open price cannot be negative"]
    },
    highPrice: {
        type: Number,
        min: [0, "High price cannot be negative"]
    },
    lowPrice: {
        type: Number,
        min: [0, "Low price cannot be negative"]
    },
    lastUpdateTime: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
PositionsSchema.index({ userId: 1, symbol: 1, product: 1 }, { unique: true });
PositionsSchema.index({ userId: 1, createdAt: -1 });

// Virtual for net quantity
PositionsSchema.virtual('netQuantity').get(function() {
    return this.buyQuantity - this.sellQuantity;
});

// Virtual for average buy-sell price
PositionsSchema.virtual('averageBuySellPrice').get(function() {
    if (this.netQuantity === 0) return 0;
    return this.netQuantity > 0 ? this.buyAveragePrice : this.sellAveragePrice;
});

// Pre-save middleware to update calculations
PositionsSchema.pre('save', function(next) {
    // Update profit/loss calculations
    this.profitLoss = this.calculateProfitLoss();
    this.unrealizedProfitLoss = this.calculateUnrealizedProfitLoss();
    this.lastUpdateTime = new Date();
    next();
});

// Method to calculate profit/loss
PositionsSchema.methods.calculateProfitLoss = function() {
    return this.realizedProfitLoss + this.calculateUnrealizedProfitLoss();
};

// Method to calculate unrealized profit/loss
PositionsSchema.methods.calculateUnrealizedProfitLoss = function() {
    const netQty = this.netQuantity;
    if (netQty === 0) return 0;
    
    const avgPrice = this.averageBuySellPrice;
    return netQty * (this.lastTradedPrice - avgPrice) * this.multiplier;
};

// Method to update market price
PositionsSchema.methods.updateMarketPrice = function(newPrice) {
    this.lastTradedPrice = newPrice;
    this.profitLoss = this.calculateProfitLoss();
    this.unrealizedProfitLoss = this.calculateUnrealizedProfitLoss();
};

module.exports = { PositionsSchema };
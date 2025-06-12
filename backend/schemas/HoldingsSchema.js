const { Schema } = require("mongoose");

const HoldingsSchema = new Schema({
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
    quantity: {
        type: Number,
        required: [true, "Quantity is required"],
        min: [0, "Quantity cannot be negative"],
        validate: {
            validator: Number.isInteger,
            message: "Quantity must be a whole number"
        }
    },
    averageBuyPrice: {
        type: Number,
        required: [true, "Average buy price is required"],
        min: [0, "Average buy price cannot be negative"]
    },
    currentMarketPrice: {
        type: Number,
        required: [true, "Current market price is required"],
        min: [0, "Current market price cannot be negative"]
    },
    investedAmount: {
        type: Number,
        default: function() {
            return this.quantity * this.averageBuyPrice;
        }
    },
    currentValue: {
        type: Number,
        default: function() {
            return this.quantity * this.currentMarketPrice;
        }
    },
    profitLoss: {
        type: Number,
        default: function() {
            return this.currentValue - this.investedAmount;
        }
    },
    profitLossPercentage: {
        type: Number,
        default: function() {
            return ((this.currentValue - this.investedAmount) / this.investedAmount) * 100;
        }
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
    lastTradedPrice: {
        type: Number,
        min: [0, "Last traded price cannot be negative"]
    },
    collateralQuantity: {
        type: Number,
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: "Collateral quantity must be a whole number"
        }
    },
    collateralValue: {
        type: Number,
        default: function() {
            return this.collateralQuantity * this.currentMarketPrice;
        }
    },
    pledgedQuantity: {
        type: Number,
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: "Pledged quantity must be a whole number"
        }
    },
    t1Quantity: {
        type: Number,
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: "T1 quantity must be a whole number"
        }
    },
    authorizedQuantity: {
        type: Number,
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: "Authorized quantity must be a whole number"
        }
    },
    isin: {
        type: String,
        match: [/^[A-Z]{2}[A-Z0-9]{10}\d$/, "Please enter a valid ISIN"]
    },
    industry: String,
    sector: String,
    companyName: String,
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
HoldingsSchema.index({ userId: 1, symbol: 1 }, { unique: true });
HoldingsSchema.index({ userId: 1, createdAt: -1 });

// Virtual for available quantity
HoldingsSchema.virtual('availableQuantity').get(function() {
    return this.quantity - this.pledgedQuantity - this.collateralQuantity;
});

// Virtual for total holding value
HoldingsSchema.virtual('totalValue').get(function() {
    return this.currentValue + (this.t1Quantity * this.currentMarketPrice);
});

// Pre-save middleware to update lastUpdated
HoldingsSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

// Method to check if holding can be sold
HoldingsSchema.methods.canSell = function(quantity) {
    return this.availableQuantity >= quantity;
};

// Method to update market price
HoldingsSchema.methods.updateMarketPrice = function(newPrice) {
    this.currentMarketPrice = newPrice;
    this.currentValue = this.quantity * newPrice;
    this.profitLoss = this.currentValue - this.investedAmount;
    this.profitLossPercentage = (this.profitLoss / this.investedAmount) * 100;
};

module.exports = { HoldingsSchema };

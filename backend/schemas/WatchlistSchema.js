const { Schema } = require("mongoose");

const WatchlistItemSchema = new Schema({
    symbol: {
        type: String,
        required: [true, "Stock symbol is required"],
        uppercase: true,
        trim: true
    },
    exchange: {
        type: String,
        enum: ["NSE", "BSE"],
        required: [true, "Exchange is required"],
        default: "NSE"
    },
    lastPrice: {
        type: Number,
        min: [0, "Last price cannot be negative"]
    },
    change: {
        value: {
            type: Number,
            default: 0
        },
        percentage: {
            type: Number,
            default: 0
        }
    },
    volume: {
        type: Number,
        min: [0, "Volume cannot be negative"]
    },
    openPrice: Number,
    highPrice: Number,
    lowPrice: Number,
    previousClose: Number,
    lastUpdateTime: {
        type: Date,
        default: Date.now
    },
    notes: String,
    alerts: [{
        type: {
            type: String,
            enum: ["PRICE_ABOVE", "PRICE_BELOW", "CHANGE_ABOVE", "CHANGE_BELOW", "VOLUME_ABOVE"],
            required: true
        },
        value: {
            type: Number,
            required: true
        },
        active: {
            type: Boolean,
            default: true
        },
        notificationSent: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    _id: false,
    timestamps: false
});

const WatchlistSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: [true, "User ID is required"],
        index: true
    },
    name: {
        type: String,
        required: [true, "Watchlist name is required"],
        trim: true,
        maxlength: [50, "Watchlist name cannot exceed 50 characters"]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [200, "Description cannot exceed 200 characters"]
    },
    items: [WatchlistItemSchema],
    isDefault: {
        type: Boolean,
        default: false
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    color: {
        type: String,
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Please enter a valid hex color code"]
    },
    icon: String
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
WatchlistSchema.index({ userId: 1, name: 1 }, { unique: true });
WatchlistSchema.index({ userId: 1, isDefault: 1 });

// Virtual for items count
WatchlistSchema.virtual('itemsCount').get(function() {
    return this.items.length;
});

// Pre-save middleware to ensure only one default watchlist
WatchlistSchema.pre('save', async function(next) {
    if (this.isDefault) {
        try {
            await this.constructor.updateMany(
                { userId: this.userId, _id: { $ne: this._id } },
                { $set: { isDefault: false } }
            );
        } catch (error) {
            next(error);
        }
    }
    next();
});

// Method to add item to watchlist
WatchlistSchema.methods.addItem = function(item) {
    const existingItemIndex = this.items.findIndex(
        i => i.symbol === item.symbol && i.exchange === item.exchange
    );
    
    if (existingItemIndex > -1) {
        this.items[existingItemIndex] = {
            ...this.items[existingItemIndex],
            ...item,
            lastUpdateTime: new Date()
        };
    } else {
        this.items.push({
            ...item,
            lastUpdateTime: new Date()
        });
    }
};

// Method to remove item from watchlist
WatchlistSchema.methods.removeItem = function(symbol, exchange = "NSE") {
    this.items = this.items.filter(
        item => !(item.symbol === symbol && item.exchange === exchange)
    );
};

// Method to update item prices
WatchlistSchema.methods.updatePrices = function(updates) {
    updates.forEach(update => {
        const item = this.items.find(
            i => i.symbol === update.symbol && i.exchange === update.exchange
        );
        if (item) {
            Object.assign(item, update, { lastUpdateTime: new Date() });
        }
    });
};

// Method to check if symbol exists
WatchlistSchema.methods.hasSymbol = function(symbol, exchange = "NSE") {
    return this.items.some(
        item => item.symbol === symbol && item.exchange === exchange
    );
};

// Static method to get user's default watchlist
WatchlistSchema.statics.getDefaultWatchlist = async function(userId) {
    return await this.findOne({ userId, isDefault: true });
};

module.exports = { WatchlistSchema };

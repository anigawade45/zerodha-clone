const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please login to continue'
            });
        }

        // Verify token
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        error: 'Token expired',
                        message: 'Your session has expired. Please login again.'
                    });
                }
                return res.status(403).json({
                    error: 'Invalid token',
                    message: 'Authentication failed. Please login again.'
                });
            }

            req.user = user;
            next();
        });
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'An unexpected error occurred. Please try again later.'
        });
    }
};

module.exports = { authenticateToken }; 
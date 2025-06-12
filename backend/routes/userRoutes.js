const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { UserModel } = require("../models/UserModel");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("❌ ERROR: JWT_SECRET is not set in .env");
    process.exit(1);
}

// Input validation middleware
const loginValidation = [
    body("email").isEmail().normalizeEmail().withMessage("Invalid email format"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
];

const registerValidation = [
    body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters long"),
    body("email").isEmail().normalizeEmail().withMessage("Invalid email format"),
    body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
        .withMessage("Password must contain at least one uppercase letter, one lowercase letter, one number and one special character")
];

// ✅ Login User
router.post("/login", loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error("Validation errors:", errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        console.log("Login attempt for email:", email);

        const user = await UserModel.findOne({ email }).select("+password");
        if (!user) {
            console.error("User not found:", email);
            return res.status(401).json({ 
                error: "Invalid credentials",
                message: "Please check your email and password"
            });
        }

        console.log("User found, comparing password...");
        console.log("Input password:", password);
        console.log("Stored hashed password:", user.password);
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password match result:", isMatch);
        if (!isMatch) {
            console.error("Password mismatch for user:", email);
            return res.status(401).json({ 
                error: "Invalid credentials",
                message: "Please check your email and password"
            });
        }

        // Email verification check temporarily disabled
        // if (!user.emailVerified) {
        //     console.error("Account not verified:", email);
        //     return res.status(403).json({
        //         error: "Account not verified",
        //         message: "Please verify your email address"
        //     });
        // }

        const token = jwt.sign(
            { 
                userId: user._id,
                email: user.email,
                role: user.role 
            }, 
            JWT_SECRET, 
            { expiresIn: "1d" }
        );

        // Set refresh token in HTTP-only cookie
        const refreshToken = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        console.log("Login successful for user:", email);
        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                lastLogin: new Date()
            }
        });

    } catch (error) {
        console.error("Login Error Details:", error);
        res.status(500).json({ 
            error: "Server error",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Verify User Token
router.get("/verify", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ 
                valid: false, 
                error: "Authentication required",
                message: "Please login to continue" 
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await UserModel.findById(decoded.userId)
            .select("-password -refreshToken");

        if (!user) {
            return res.status(401).json({ 
                valid: false, 
                error: "User not found",
                message: "Account not found. Please register."
            });
        }

        res.status(200).json({ 
            valid: true, 
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error("Verify Error:", error);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ 
                valid: false, 
                error: "Token expired",
                message: "Your session has expired. Please login again."
            });
        }
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ 
                valid: false, 
                error: "Invalid token",
                message: "Authentication failed. Please login again."
            });
        }
        res.status(500).json({ 
            valid: false, 
            error: "Server error",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Register User
router.post("/register", registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, mobile, pan, dob } = req.body;

        // Check if user exists
        const existingUser = await UserModel.findOne({ 
            $or: [
                { email },
                { mobile },
                { pan }
            ]
        });

        if (existingUser) {
            let field = "email";
            if (existingUser.mobile === mobile) field = "mobile";
            if (existingUser.pan === pan) field = "PAN";
            
            return res.status(400).json({ 
                error: `${field} already registered`,
                message: `This ${field} is already registered with us`
            });
        }

        // Generate verification token
        const verificationToken = jwt.sign(
            { email },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        // Save user to database
        const newUser = new UserModel({
            name,
            email,
            password,
            mobile,
            pan,
            dob: new Date(dob),
            verificationToken,
            role: "USER",
            emailVerified: true
        });

        await newUser.save();

        // TODO: Send verification email
        // await sendVerificationEmail(email, verificationToken);

        res.status(201).json({ 
            message: "Registration successful!",
            info: "Please check your email for verification instructions."
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ 
            error: "Registration failed",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// ✅ Refresh Token
router.post("/refresh-token", async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        
        if (!refreshToken) {
            return res.status(401).json({ 
                error: "No refresh token",
                message: "Please login again"
            });
        }

        jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ 
                    error: "Invalid refresh token",
                    message: "Please login again"
                });
            }

            const user = await UserModel.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({ 
                    error: "User not found",
                    message: "Account not found"
                });
            }

            const newToken = jwt.sign(
                { 
                    userId: user._id,
                    email: user.email,
                    role: user.role 
                },
                JWT_SECRET,
                { expiresIn: "1d" }
            );

            res.json({
                token: newToken,
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    role: user.role
                }
            });
        });
    } catch (error) {
        console.error("Refresh Token Error:", error);
        res.status(500).json({ 
            error: "Server error",
            message: "An unexpected error occurred"
        });
    }
});

// ✅ Logout
router.post("/logout", (req, res) => {
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
});

// Temporary route to reset password
router.post("/reset-password", async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                error: "User not found",
                message: "No account found with this email"
            });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password and enable account
        user.password = hashedPassword;
        user.emailVerified = true;
        await user.save();

        res.status(200).json({ 
            message: "Password reset successful",
            info: "You can now login with your new password"
        });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ 
            error: "Password reset failed",
            message: "An unexpected error occurred. Please try again later."
        });
    }
});

// Temporary route to create a test user
router.post("/create-test-user", async (req, res) => {
    try {
        const testUser = {
            name: "Test User",
            email: "test@example.com",
            password: "Test123!@#",
            mobile: "9876543210",
            dob: new Date("1990-01-01"),
            emailVerified: true,
            role: "USER"
        };

        // Delete existing test user if any
        await UserModel.deleteOne({ email: testUser.email });

        // Create new user with known password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(testUser.password, salt);
        
        const newUser = new UserModel({
            ...testUser,
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({ 
            message: "Test user created successfully",
            credentials: {
                email: testUser.email,
                password: testUser.password
            }
        });
    } catch (error) {
        console.error("Create Test User Error:", error);
        res.status(500).json({ 
            error: "Failed to create test user",
            message: error.message
        });
    }
});

module.exports = router;

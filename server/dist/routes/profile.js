"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_js_1 = require("../models/User.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
function publicUser(user) {
    return {
        id: user._id.toString(),
        username: user.username,
        profilePicture: user.profilePicture || "",
        isOnline: Boolean(user.isOnline),
        createdAt: user.createdAt
    };
}
router.put("/picture", auth_js_1.requireAuth, async (req, res) => {
    try {
        const profilePicture = String(req.body.profilePicture || "");
        if (!profilePicture) {
            res.status(400).json({
                message: "Profile picture is required"
            });
            return;
        }
        if (!profilePicture.startsWith("data:image/")) {
            res.status(400).json({
                message: "Invalid profile picture"
            });
            return;
        }
        if (profilePicture.length > 2_000_000) {
            res.status(400).json({
                message: "Profile picture must be smaller than 1.5 MB"
            });
            return;
        }
        const user = await User_js_1.User.findByIdAndUpdate(req.userId, {
            profilePicture
        }, {
            new: true
        });
        if (!user) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }
        res.json({
            message: "Profile picture updated",
            user: publicUser(user)
        });
    }
    catch (error) {
        console.error("Profile picture update error:", error);
        res.status(500).json({
            message: "Unable to update profile picture"
        });
    }
});
router.put("/password", auth_js_1.requireAuth, async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || "");
        const newPassword = String(req.body.newPassword || "");
        const confirmPassword = String(req.body.confirmPassword || "");
        if (!currentPassword ||
            !newPassword ||
            !confirmPassword) {
            res.status(400).json({
                message: "All password fields are required"
            });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({
                message: "New password must contain at least 6 characters"
            });
            return;
        }
        if (newPassword !== confirmPassword) {
            res.status(400).json({
                message: "New passwords do not match"
            });
            return;
        }
        if (currentPassword === newPassword) {
            res.status(400).json({
                message: "New password must be different from the current password"
            });
            return;
        }
        const user = await User_js_1.User.findById(req.userId);
        if (!user) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }
        const validPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!validPassword) {
            res.status(401).json({
                message: "Current password is incorrect"
            });
            return;
        }
        user.password =
            await bcryptjs_1.default.hash(newPassword, 12);
        await user.save();
        res.json({
            message: "Password changed successfully"
        });
    }
    catch (error) {
        console.error("Password update error:", error);
        res.status(500).json({
            message: "Unable to change password"
        });
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.friendEvents = void 0;
const express_1 = require("express");
const node_events_1 = require("node:events");
const User_js_1 = require("../models/User.js");
const Friendship_js_1 = require("../models/Friendship.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
exports.friendEvents = new node_events_1.EventEmitter();
function publicUser(user) {
    return {
        id: user._id.toString(),
        username: user.username,
        profilePicture: user.profilePicture || "",
        isOnline: Boolean(user.isOnline)
    };
}
/*
 * Search users by username.
 * Only authenticated users can search.
 */
router.get("/search", auth_js_1.requireAuth, async (req, res) => {
    try {
        const query = String(req.query.q || "")
            .trim()
            .toLowerCase();
        if (query.length < 2) {
            res.json({ users: [] });
            return;
        }
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const users = await User_js_1.User.find({
            username: {
                $regex: `^${escaped}`,
                $options: "i"
            },
            _id: {
                $ne: req.userId
            }
        })
            .select("username profilePicture isOnline")
            .limit(15);
        res.json({
            users: users.map(publicUser)
        });
    }
    catch (error) {
        console.error("User search error:", error);
        res.status(500).json({
            message: "Unable to search users"
        });
    }
});
/*
 * Send a friend request.
 */
router.post("/request", auth_js_1.requireAuth, async (req, res) => {
    try {
        const username = String(req.body.username || "")
            .trim()
            .toLowerCase();
        if (!username) {
            res.status(400).json({
                message: "Username is required"
            });
            return;
        }
        const target = await User_js_1.User.findOne({
            username
        });
        if (!target) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }
        if (target.id === req.userId) {
            res.status(400).json({
                message: "You cannot add yourself"
            });
            return;
        }
        const existing = await Friendship_js_1.Friendship.findOne({
            $or: [
                {
                    sender: req.userId,
                    receiver: target.id
                },
                {
                    sender: target.id,
                    receiver: req.userId
                }
            ]
        });
        if (existing) {
            if (existing.status === "accepted") {
                res.status(409).json({
                    message: "You are already friends"
                });
                return;
            }
            res.status(409).json({
                message: "A friend request already exists"
            });
            return;
        }
        const friendship = await Friendship_js_1.Friendship.create({
            sender: req.userId,
            receiver: target.id,
            status: "pending"
        });
        exports.friendEvents.emit("request:created", {
            requestId: friendship._id.toString(),
            senderId: req.userId,
            receiverId: target.id.toString()
        });
        res.status(201).json({
            message: "Friend request sent"
        });
    }
    catch (error) {
        if (error?.code === 11000) {
            res.status(409).json({
                message: "A friend request already exists"
            });
            return;
        }
        console.error("Friend request error:", error);
        res.status(500).json({
            message: "Unable to send friend request"
        });
    }
});
/*
 * Get incoming pending friend requests.
 */
router.get("/requests", auth_js_1.requireAuth, async (req, res) => {
    try {
        const requests = await Friendship_js_1.Friendship.find({
            receiver: req.userId,
            status: "pending"
        })
            .populate("sender", "username profilePicture isOnline")
            .sort({ createdAt: -1 });
        res.json({
            requests: requests.map((request) => ({
                id: request._id.toString(),
                sender: publicUser(request.sender),
                createdAt: request.createdAt
            }))
        });
    }
    catch (error) {
        console.error("Friend request list error:", error);
        res.status(500).json({
            message: "Unable to load friend requests"
        });
    }
});
/*
 * Accept a pending friend request.
 */
router.post("/requests/:requestId/accept", auth_js_1.requireAuth, async (req, res) => {
    try {
        const request = await Friendship_js_1.Friendship.findOne({
            _id: req.params.requestId,
            receiver: req.userId,
            status: "pending"
        });
        if (!request) {
            res.status(404).json({
                message: "Friend request not found"
            });
            return;
        }
        request.status = "accepted";
        await request.save();
        exports.friendEvents.emit("request:accepted", {
            requestId: request._id.toString(),
            senderId: request.sender.toString(),
            receiverId: req.userId
        });
        const friend = await User_js_1.User.findById(request.sender);
        res.json({
            message: "Friend request accepted",
            friend: friend ? publicUser(friend) : null
        });
    }
    catch (error) {
        console.error("Accept friend request error:", error);
        res.status(500).json({
            message: "Unable to accept friend request"
        });
    }
});
/*
 * Reject/delete a pending request.
 */
router.delete("/requests/:requestId", auth_js_1.requireAuth, async (req, res) => {
    try {
        const deleted = await Friendship_js_1.Friendship.findOneAndDelete({
            _id: req.params.requestId,
            receiver: req.userId,
            status: "pending"
        });
        if (!deleted) {
            res.status(404).json({
                message: "Friend request not found"
            });
            return;
        }
        res.json({
            message: "Friend request removed"
        });
    }
    catch (error) {
        console.error("Remove request error:", error);
        res.status(500).json({
            message: "Unable to remove friend request"
        });
    }
});
/*
 * Get all accepted friends.
 */
router.get("/", auth_js_1.requireAuth, async (req, res) => {
    try {
        const relationships = await Friendship_js_1.Friendship.find({
            status: "accepted",
            $or: [
                { sender: req.userId },
                { receiver: req.userId }
            ]
        });
        const friendIds = relationships.map((relationship) => relationship.sender.toString() === req.userId
            ? relationship.receiver
            : relationship.sender);
        const friends = await User_js_1.User.find({
            _id: { $in: friendIds }
        }).select("username profilePicture isOnline");
        res.json({
            friends: friends.map(publicUser)
        });
    }
    catch (error) {
        console.error("Friends list error:", error);
        res.status(500).json({
            message: "Unable to load friends"
        });
    }
});
/*
 * Remove an existing friendship.
 */
router.delete("/:friendId", auth_js_1.requireAuth, async (req, res) => {
    try {
        const friendship = await Friendship_js_1.Friendship.findOne({
            status: "accepted",
            $or: [
                {
                    sender: req.userId,
                    receiver: req.params.friendId
                },
                {
                    sender: req.params.friendId,
                    receiver: req.userId
                }
            ]
        });
        if (!friendship) {
            res.status(404).json({
                message: "Friendship not found"
            });
            return;
        }
        await friendship.deleteOne();
        res.json({
            message: "Friend removed"
        });
    }
    catch (error) {
        console.error("Remove friend error:", error);
        res.status(500).json({
            message: "Unable to remove friend"
        });
    }
});
exports.default = router;

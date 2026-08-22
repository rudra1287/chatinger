"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Message_js_1 = require("../models/Message.js");
const Friendship_js_1 = require("../models/Friendship.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
async function areFriends(userA, userB) {
    const friendship = await Friendship_js_1.Friendship.findOne({
        status: "accepted",
        $or: [
            { sender: userA, receiver: userB },
            { sender: userB, receiver: userA }
        ]
    });
    return Boolean(friendship);
}
/*
 * Get conversation history.
 */
router.get("/:userId", auth_js_1.requireAuth, async (req, res) => {
    try {
        const currentUser = req.userId;
        const otherUser = String(req.params.userId);
        if (!(await areFriends(currentUser, otherUser))) {
            res.status(403).json({
                message: "You can only view messages with friends"
            });
            return;
        }
        const messages = await Message_js_1.Message.find({
            $or: [
                {
                    sender: currentUser,
                    receiver: otherUser
                },
                {
                    sender: otherUser,
                    receiver: currentUser
                }
            ]
        })
            .sort({ createdAt: 1 })
            .limit(500)
            .lean();
        /*
         * Opening the conversation marks incoming messages
         * as read.
         */
        await Message_js_1.Message.updateMany({
            sender: otherUser,
            receiver: currentUser,
            read: false
        }, {
            $set: { read: true }
        });
        res.json({
            messages
        });
    }
    catch (error) {
        console.error("Message history error:", error);
        res.status(500).json({
            message: "Unable to load messages"
        });
    }
});
/*
 * Mark a conversation as read.
 */
router.post("/:userId/read", auth_js_1.requireAuth, async (req, res) => {
    try {
        await Message_js_1.Message.updateMany({
            sender: req.params.userId,
            receiver: req.userId,
            read: false
        }, {
            $set: { read: true }
        });
        res.json({
            ok: true
        });
    }
    catch {
        res.status(500).json({
            message: "Unable to mark messages as read"
        });
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureSocket = configureSocket;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Message_js_1 = require("../models/Message.js");
const Friendship_js_1 = require("../models/Friendship.js");
const friends_js_1 = require("../routes/friends.js");
const User_js_1 = require("../models/User.js");
const onlineUsers = new Map();
function authenticateSocket(socket) {
    const token = socket.handshake.auth?.token;
    if (!token) {
        throw new Error("Authentication required");
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    const payload = jsonwebtoken_1.default.verify(token, secret);
    return payload.userId;
}
async function areFriends(userA, userB) {
    const friendship = await Friendship_js_1.Friendship.findOne({
        status: "accepted",
        $or: [
            {
                sender: userA,
                receiver: userB
            },
            {
                sender: userB,
                receiver: userA
            }
        ]
    });
    return Boolean(friendship);
}
function configureSocket(io) {
    friends_js_1.friendEvents.on("request:created", ({ requestId, senderId, receiverId }) => {
        io.to(`user:${receiverId}`).emit("friend:request", {
            requestId,
            senderId
        });
    });
    friends_js_1.friendEvents.on("request:accepted", ({ requestId, senderId, receiverId }) => {
        io.to(`user:${senderId}`).emit("friend:accepted", {
            requestId,
            friendId: receiverId
        });
        io.to(`user:${receiverId}`).emit("friend:accepted", {
            requestId,
            friendId: senderId
        });
    });
    io.use((socket, next) => {
        try {
            const userId = authenticateSocket(socket);
            socket.data.userId = userId;
            next();
        }
        catch {
            next(new Error("Unauthorized"));
        }
    });
    io.on("connection", async (socket) => {
        const userId = socket.data.userId;
        /*
         * Every user gets a private room.
         */
        socket.join(`user:${userId}`);
        /*
         * Track multiple tabs/devices correctly.
         */
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);
        await User_js_1.User.findByIdAndUpdate(userId, {
            isOnline: true
        });
        io.emit("presence:update", {
            userId,
            isOnline: true
        });
        /*
         * Send a message.
         */
        socket.on("message:send", async (payload, callback) => {
            try {
                const receiver = String(payload?.receiver || "").trim();
                const text = String(payload?.message || "").trim();
                if (!receiver) {
                    callback?.({
                        ok: false,
                        error: "Receiver is required"
                    });
                    return;
                }
                if (!text) {
                    callback?.({
                        ok: false,
                        error: "Message cannot be empty"
                    });
                    return;
                }
                if (text.length > 2000) {
                    callback?.({
                        ok: false,
                        error: "Message is too long"
                    });
                    return;
                }
                if (receiver === userId) {
                    callback?.({
                        ok: false,
                        error: "You cannot message yourself"
                    });
                    return;
                }
                if (!(await areFriends(userId, receiver))) {
                    callback?.({
                        ok: false,
                        error: "You can only message friends"
                    });
                    return;
                }
                const savedMessage = await Message_js_1.Message.create({
                    sender: userId,
                    receiver,
                    message: text,
                    read: false
                });
                const message = {
                    id: savedMessage.id,
                    sender: userId,
                    receiver,
                    message: savedMessage.message,
                    createdAt: savedMessage.createdAt,
                    read: savedMessage.read
                };
                /*
                 * Sender receives confirmation.
                 */
                io.to(`user:${userId}`).emit("message:new", message);
                /*
                 * Receiver gets the message immediately.
                 */
                io.to(`user:${receiver}`).emit("message:new", message);
                /*
                 * Both clients can refresh their conversation
                 * preview/unread count.
                 */
                io.to(`user:${userId}`).emit("chat:update", {
                    userId: receiver
                });
                io.to(`user:${receiver}`).emit("chat:update", {
                    userId
                });
                callback?.({
                    ok: true,
                    message
                });
            }
            catch (error) {
                console.error("Socket message error:", error);
                callback?.({
                    ok: false,
                    error: "Unable to send message"
                });
            }
        });
        /*
         * Mark incoming messages as read.
         */
        socket.on("message:read", async (payload) => {
            const otherUser = String(payload?.userId || "").trim();
            if (!otherUser) {
                return;
            }
            if (!(await areFriends(userId, otherUser))) {
                return;
            }
            await Message_js_1.Message.updateMany({
                sender: otherUser,
                receiver: userId,
                read: false
            }, {
                $set: {
                    read: true
                }
            });
            io.to(`user:${otherUser}`).emit("messages:read", {
                userId
            });
        });
        /*
         * Client asks for the current online state
         * of another user.
         */
        socket.on("presence:check", async (targetUserId, callback) => {
            const target = await User_js_1.User.findById(targetUserId)
                .select("isOnline")
                .lean();
            callback?.({
                userId: targetUserId,
                isOnline: Boolean(target?.isOnline)
            });
        });
        /*
         * Disconnect.
         *
         * A user can have multiple tabs open, so only
         * mark them offline after their final socket closes.
         */
        socket.on("disconnect", async () => {
            const sockets = onlineUsers.get(userId);
            if (!sockets) {
                return;
            }
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                onlineUsers.delete(userId);
                await User_js_1.User.findByIdAndUpdate(userId, {
                    isOnline: false
                });
                io.emit("presence:update", {
                    userId,
                    isOnline: false
                });
            }
        });
    });
}

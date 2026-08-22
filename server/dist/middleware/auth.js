"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: "JWT_SECRET is not configured" });
        return;
    }
    try {
        const token = header.substring(7);
        const payload = jsonwebtoken_1.default.verify(token, secret);
        req.userId = payload.userId;
        next();
    }
    catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}

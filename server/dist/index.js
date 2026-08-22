"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_http_1 = require("node:http");
const socket_io_1 = require("socket.io");
const database_js_1 = require("./config/database.js");
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const friends_js_1 = __importDefault(require("./routes/friends.js"));
const messages_js_1 = __importDefault(require("./routes/messages.js"));
const profile_js_1 = __importDefault(require("./routes/profile.js"));
const index_js_1 = require("./socket/index.js");
const app = (0, express_1.default)();
const server = (0, node_http_1.createServer)(app);
const PORT = Number(process.env.PORT || 5000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const io = new socket_io_1.Server(server, {
    cors: {
        origin: CLIENT_URL,
        credentials: true
    }
});
app.use((0, cors_1.default)({
    origin: CLIENT_URL,
    credentials: true
}));
app.use(express_1.default.json({
    limit: "2mb"
}));
app.use("/api/auth", auth_js_1.default);
app.use("/api/friends", friends_js_1.default);
app.use("/api/messages", messages_js_1.default);
app.use("/api/profile", profile_js_1.default);
app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        service: "ChatNova API"
    });
});
(0, index_js_1.configureSocket)(io);
async function start() {
    await (0, database_js_1.connectDatabase)();
    server.listen(PORT, () => {
        console.log(`ChatNova API running on http://localhost:${PORT}`);
    });
}
start().catch((error) => {
    console.error("Failed to start ChatNova:", error);
    process.exit(1);
});

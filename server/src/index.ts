import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { connectDatabase } from "./config/database.js";
import authRoutes from "./routes/auth.js";
import friendsRoutes from "./routes/friends.js";
import messagesRoutes from "./routes/messages.js";
import profileRoutes from "./routes/profile.js";
import { configureSocket } from "./socket/index.js";

const app = express();
const server = createServer(app);

const PORT = Number(process.env.PORT || 5000);
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true
  }
});

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/profile", profileRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ChatNova API"
  });
});

configureSocket(io);

async function start(): Promise<void> {
  await connectDatabase();

  server.listen(PORT, () => {
    console.log(
      `ChatNova API running on http://localhost:${PORT}`
    );
  });
}

start().catch((error) => {
  console.error(
    "Failed to start ChatNova:",
    error
  );

  process.exit(1);
});

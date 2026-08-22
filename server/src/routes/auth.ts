import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";

const router = Router();

function createToken(userId: string): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { userId },
    secret,
    { expiresIn: "7d" }
  );
}

function publicUser(user: {
  _id: unknown;
  username: string;
  profilePicture: string;
  isOnline: boolean;
  createdAt: Date;
}) {
  return {
    id: String(user._id),
    username: user.username,
    profilePicture: user.profilePicture || "",
    isOnline: user.isOnline,
    createdAt: user.createdAt
  };
}

router.post("/signup", async (req, res) => {
  try {
    const {
      username,
      password,
      confirmPassword,
      profilePicture = ""
    } = req.body;

    const cleanUsername = String(username || "")
      .trim()
      .toLowerCase();

    if (!cleanUsername || !password || !confirmPassword) {
      res.status(400).json({
        message: "Username, password and confirmation are required"
      });
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      res.status(400).json({
        message:
          "Username must be 3-24 characters and use only letters, numbers or underscores"
      });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({
        message: "Password must be at least 6 characters"
      });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({
        message: "Passwords do not match"
      });
      return;
    }

    const existingUser = await User.findOne({
      username: cleanUsername
    });

    if (existingUser) {
      res.status(409).json({
        message: "That username is already taken"
      });
      return;
    }

    if (
      typeof profilePicture !== "string" ||
      profilePicture.length > 2_000_000
    ) {
      res.status(400).json({
        message: "Profile picture is too large"
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(
      String(password),
      12
    );

    const user = await User.create({
      username: cleanUsername,
      password: hashedPassword,
      profilePicture,
      isOnline: false
    });

    const token = createToken(user.id);

    res.status(201).json({
      token,
      user: publicUser(user)
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({
        message: "That username is already taken"
      });
      return;
    }

    console.error("Signup error:", error);

    res.status(500).json({
      message: "Unable to create account"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const cleanUsername = String(req.body.username || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (!cleanUsername || !password) {
      res.status(400).json({
        message: "Username and password are required"
      });
      return;
    }

    const user = await User.findOne({
      username: cleanUsername
    });

    if (!user) {
      res.status(401).json({
        message: "Invalid username or password"
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      res.status(401).json({
        message: "Invalid username or password"
      });
      return;
    }

    user.isOnline = true;
    await user.save();

    const token = createToken(user.id);

    res.json({
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Unable to log in"
    });
  }
});

router.get(
  "/me",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await User.findById(req.userId);

      if (!user) {
        res.status(404).json({
          message: "User account no longer exists"
        });
        return;
      }

      res.json({
        user: publicUser(user)
      });
    } catch {
      res.status(500).json({
        message: "Unable to load account"
      });
    }
  }
);

router.post(
  "/logout",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.userId) {
        await User.findByIdAndUpdate(
          req.userId,
          { isOnline: false }
        );
      }

      res.json({
        message: "Logged out successfully"
      });
    } catch {
      res.status(500).json({
        message: "Unable to log out"
      });
    }
  }
);

export default router;

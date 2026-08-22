import { Router, Response } from "express";
import { EventEmitter } from "node:events";
import { User } from "../models/User.js";
import { Friendship } from "../models/Friendship.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";

const router = Router();

export const friendEvents = new EventEmitter();


function publicUser(user: any) {
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
router.get(
  "/search",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const query = String(req.query.q || "")
        .trim()
        .toLowerCase();

      if (query.length < 2) {
        res.json({ users: [] });
        return;
      }

      const escaped = query.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const users = await User.find({
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
    } catch (error) {
      console.error("User search error:", error);

      res.status(500).json({
        message: "Unable to search users"
      });
    }
  }
);

/*
 * Send a friend request.
 */
router.post(
  "/request",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
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

      const target = await User.findOne({
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

      const existing = await Friendship.findOne({
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

      const friendship = await Friendship.create({
        sender: req.userId,
        receiver: target.id,
        status: "pending"
      });

      friendEvents.emit("request:created", {
        requestId: friendship._id.toString(),
        senderId: req.userId,
        receiverId: target.id.toString()
      });

      res.status(201).json({
        message: "Friend request sent"
      });
    } catch (error: any) {
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
  }
);

/*
 * Get incoming pending friend requests.
 */
router.get(
  "/requests",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const requests = await Friendship.find({
        receiver: req.userId,
        status: "pending"
      })
        .populate(
          "sender",
          "username profilePicture isOnline"
        )
        .sort({ createdAt: -1 });

      res.json({
        requests: requests.map((request: any) => ({
          id: request._id.toString(),
          sender: publicUser(request.sender),
          createdAt: request.createdAt
        }))
      });
    } catch (error) {
      console.error("Friend request list error:", error);

      res.status(500).json({
        message: "Unable to load friend requests"
      });
    }
  }
);

/*
 * Accept a pending friend request.
 */
router.post(
  "/requests/:requestId/accept",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const request = await Friendship.findOne({
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

      friendEvents.emit("request:accepted", {
        requestId: request._id.toString(),
        senderId: request.sender.toString(),
        receiverId: req.userId
      });

      const friend = await User.findById(request.sender);

      res.json({
        message: "Friend request accepted",
        friend: friend ? publicUser(friend) : null
      });
    } catch (error) {
      console.error("Accept friend request error:", error);

      res.status(500).json({
        message: "Unable to accept friend request"
      });
    }
  }
);

/*
 * Reject/delete a pending request.
 */
router.delete(
  "/requests/:requestId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await Friendship.findOneAndDelete({
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
    } catch (error) {
      console.error("Remove request error:", error);

      res.status(500).json({
        message: "Unable to remove friend request"
      });
    }
  }
);

/*
 * Get all accepted friends.
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const relationships = await Friendship.find({
        status: "accepted",
        $or: [
          { sender: req.userId },
          { receiver: req.userId }
        ]
      });

      const friendIds = relationships.map((relationship) =>
        relationship.sender.toString() === req.userId
          ? relationship.receiver
          : relationship.sender
      );

      const friends = await User.find({
        _id: { $in: friendIds }
      }).select("username profilePicture isOnline");

      res.json({
        friends: friends.map(publicUser)
      });
    } catch (error) {
      console.error("Friends list error:", error);

      res.status(500).json({
        message: "Unable to load friends"
      });
    }
  }
);

/*
 * Remove an existing friendship.
 */
router.delete(
  "/:friendId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const friendship = await Friendship.findOne({
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
    } catch (error) {
      console.error("Remove friend error:", error);

      res.status(500).json({
        message: "Unable to remove friend"
      });
    }
  }
);

export default router;

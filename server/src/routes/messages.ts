import { Router, Response } from "express";
import { Message } from "../models/Message.js";
import { Friendship } from "../models/Friendship.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";

const router = Router();

async function areFriends(userA: string, userB: string): Promise<boolean> {
  const friendship = await Friendship.findOne({
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
router.get(
  "/:userId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUser = req.userId!;
      const otherUser = String(req.params.userId);

      if (!(await areFriends(currentUser, otherUser))) {
        res.status(403).json({
          message: "You can only view messages with friends"
        });
        return;
      }

      const messages = await Message.find({
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
      await Message.updateMany(
        {
          sender: otherUser,
          receiver: currentUser,
          read: false
        },
        {
          $set: { read: true }
        }
      );

      res.json({
        messages
      });
    } catch (error) {
      console.error("Message history error:", error);

      res.status(500).json({
        message: "Unable to load messages"
      });
    }
  }
);

/*
 * Mark a conversation as read.
 */
router.post(
  "/:userId/read",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      await Message.updateMany(
        {
          sender: req.params.userId,
          receiver: req.userId,
          read: false
        },
        {
          $set: { read: true }
        }
      );

      res.json({
        ok: true
      });
    } catch {
      res.status(500).json({
        message: "Unable to mark messages as read"
      });
    }
  }
);

export default router;

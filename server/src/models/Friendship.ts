import mongoose, { Document, Schema, Types } from "mongoose";

export type FriendshipStatus = "pending" | "accepted";

export interface IFriendship extends Document {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
}

const friendshipSchema = new Schema<IFriendship>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending"
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

friendshipSchema.index(
  { sender: 1, receiver: 1 },
  { unique: true }
);

export const Friendship = mongoose.model<IFriendship>(
  "Friendship",
  friendshipSchema
);

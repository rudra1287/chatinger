import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMessage extends Document {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  message: string;
  createdAt: Date;
  read: boolean;
}

const messageSchema = new Schema<IMessage>({
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
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

messageSchema.index({
  sender: 1,
  receiver: 1,
  createdAt: 1
});

export const Message = mongoose.model<IMessage>(
  "Message",
  messageSchema
);

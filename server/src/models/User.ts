import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  username: string;
  password: string;
  profilePicture: string;
  isOnline: boolean;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24
    },
    password: {
      type: String,
      required: true
    },
    profilePicture: {
      type: String,
      default: ""
    },
    isOnline: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const User = mongoose.model<IUser>("User", userSchema);

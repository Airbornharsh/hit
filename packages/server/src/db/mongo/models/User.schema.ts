import mongoose from 'mongoose'

export interface IUser extends mongoose.Document {
  clerkId?: string
  name: string
  email: string
  provider: 'google' | 'email'
  admin?: boolean
  username?: string
  imageUrl?: string
  createdAt?: Date
  updatedAt?: Date
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    clerkId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: ['google', 'email'],
      required: true,
    },
    admin: {
      type: Boolean,
      default: false,
    },
    username: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    imageUrl: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
)

export default UserSchema

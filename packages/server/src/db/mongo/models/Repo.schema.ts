import mongoose from 'mongoose'
import { IUser } from './User.schema'
import { IBranch } from './Branch.schema'

export interface IRepo extends mongoose.Document {
  userId: mongoose.Schema.Types.ObjectId | IUser
  name: string
  description: string
  isPublic: boolean
  defaultBranch: mongoose.Schema.Types.ObjectId | IBranch
  createdAt: Date
  updatedAt: Date
}

const RepoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isPublic: { type: Boolean, default: false },
    defaultBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

RepoSchema.index({ userId: 1, name: 1 }, { unique: true })

export default RepoSchema

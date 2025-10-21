import mongoose from 'mongoose'
import { IRepo } from './Repo.schema'
import { IBranch } from './Branch.schema'

export interface ICommit extends mongoose.Document {
  repoId: mongoose.Schema.Types.ObjectId | IRepo
  branchId: mongoose.Schema.Types.ObjectId | IBranch
  hash: string
  parent: string
  message: string
  author: string
  timestamp: Date
  createdAt: Date
  updatedAt: Date
}

const CommitSchema = new mongoose.Schema(
  {
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repo',
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    hash: { type: String, required: true },
    parent: { type: String, required: true },
    message: { type: String, required: true },
    author: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
)

CommitSchema.index(
  { repoId: 1, branchId: 1, hash: 1, author: 1 },
  { unique: true },
)

export default CommitSchema

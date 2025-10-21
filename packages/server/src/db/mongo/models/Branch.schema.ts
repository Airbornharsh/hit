import mongoose from 'mongoose'
import { IRepo } from './Repo.schema'
import { ICommit } from './Commit.schema'

export interface IBranch extends mongoose.Document {
  repoId: mongoose.Schema.Types.ObjectId | IRepo
  name: string
  headCommit: mongoose.Schema.Types.ObjectId | ICommit
  createdAt: Date
  updatedAt: Date
}

const BranchSchema = new mongoose.Schema(
  {
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repo',
      required: true,
    },
    name: { type: String, required: true },
    headCommit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit',
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

BranchSchema.index({ repoId: 1, name: 1 }, { unique: true })

export default BranchSchema

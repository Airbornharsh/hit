import mongoose from 'mongoose'
import { IRepo } from './Repo.schema'

export interface IHash extends mongoose.Document {
  repoId: mongoose.Schema.Types.ObjectId | IRepo
  hash: string
}

const HashSchema = new mongoose.Schema({
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repo', required: true },
  hash: { type: String, required: true },
})

HashSchema.index({ repoId: 1, hash: 1 }, { unique: true })

export default HashSchema

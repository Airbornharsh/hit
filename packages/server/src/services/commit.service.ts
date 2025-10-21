import { db } from '../db/mongo/init'

class CommitService {
  static async createCommits(
    repoId: string,
    branchId: string,
    commits: {
      tree: string
      parent: string
      author: string
      timestamp: string
      message: string
    }[],
  ) {
    let headCommit = null
    for (const commit of commits) {
      try {
        const newCommit = await db?.CommitModel.create({
          repoId,
          branchId,
          hash: commit.tree,
          parent: commit.parent,
          author: commit.author,
          timestamp: commit.timestamp,
          message: commit.message,
        })
        if (!newCommit || !newCommit._id) {
          continue
        }
        headCommit = newCommit._id.toString()
      } catch (e) {
        console.error('Create commit error:', e)
      }
    }

    if (headCommit) {
      try {
        await db?.BranchModel.findByIdAndUpdate(branchId, {
          $set: { headCommit: headCommit },
        })
      } catch (e) {
        console.error('Update branch head commit error:', e)
      }
    }

    try {
      await db?.RepoModel.findOneAndUpdate(
        { _id: repoId, defaultBranch: null },
        { $set: { defaultBranch: branchId } },
        { new: true },
      )
    } catch (e) {
      console.error('Update repo default branch error:', e)
    }

    return headCommit
  }
}

export default CommitService

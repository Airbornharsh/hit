import { Router } from 'express'
import BranchController from '../controllers/branch.controller'
import Middleware from '../middlewares/auth.middleware'

const router: Router = Router()

router.use(Middleware.authMiddleware)

router.post('/', BranchController.createBranch)
router.get('/', BranchController.getBranches)

router.get('/:branchName/head-commit', BranchController.getHeadCommit)
router.post('/:branchName/commits', BranchController.createCommit)
router.get('/:branchName/commits', BranchController.getCommits)
router.get('/:branchName/commits/:commitHash', BranchController.getCommit)
router.get('/commits/:commitHash', BranchController.getCommit)
router.get('/:branchName/files', BranchController.getFiles)
router.get('/:branchName/file', BranchController.getFile)
router.get(
  '/:branchName/complete-tree',
  BranchController.getCompleteTreeStructure,
)

export default router

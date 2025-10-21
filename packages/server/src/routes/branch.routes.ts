import { Router } from 'express'
import BranchController from '../controllers/branch.controller'
import Middleware from '../middlewares/auth.middleware'

const router: Router = Router()

router.use(Middleware.authMiddleware)

router.post('/', BranchController.createBranch)
router.get('/', BranchController.getBranches)

router.get('/:branchName', BranchController.getBranch)

router.get('/:branchName/head-commit', BranchController.getHeadCommit)
router.post('/:branchName/commits', BranchController.createCommit)
router.get('/:branchName/commits/:commitHash', BranchController.getCommit)

export default router

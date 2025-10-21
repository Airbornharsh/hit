import express, { Router } from 'express'
import RepoController from '../controllers/repo.controller'
import Middleware from '../middlewares/auth.middleware'

const router: Router = express.Router()

router.use(Middleware.authMiddleware)

router.get('/signed-url/:hash', RepoController.getSignedUploadUrl)

router.post('/', RepoController.createRepo)
router.get('/', RepoController.getRepos)
router.get('/individual', RepoController.getRepo)

export default router

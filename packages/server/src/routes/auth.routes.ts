import express from 'express'
import AuthController from '../controllers/auth.controller'
import Middleware from '../middlewares/auth.middleware'
import type { Router } from 'express'

const router: Router = express.Router()

router.get('/user', Middleware.authMiddleware, AuthController.getUser)
router.patch(
  '/user/username',
  Middleware.authMiddleware,
  AuthController.updateUsername,
)
router.post('/session', AuthController.createTerminalSession)
router.post(
  '/session/:token',
  Middleware.authMiddleware,
  AuthController.completeTerminalSession,
)
router.get('/session/:sessionId', AuthController.checkTerminalSession)

export default router

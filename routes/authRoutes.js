import express from 'express'
import { login, changePassword, forgotPassword, resetPassword } from '../controllers/authController.js'
import { protect } from '../middleware/auth.js'

const authRouter = express.Router()

authRouter.post('/login', login)
authRouter.post('/change-password', protect, changePassword)
authRouter.post('/forgot-password', forgotPassword)
authRouter.post('/reset-password', resetPassword)

export default authRouter

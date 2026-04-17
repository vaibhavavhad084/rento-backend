import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import User from '../models/User.js'

const generateToken = (user) => {
  const payload = { id: user._id.toString(), role: user.role }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' })
}

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  })
}

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body

    if (!email || !password || !role) {
      return res.json({ success: false, message: 'Email, password, and role are required.' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.json({ success: false, message: 'User not found' })
    }

    if (user.role !== role) {
      return res.json({ success: false, message: `Please use the ${user.role} login option for this account.` })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid credentials' })
    }

    const token = generateToken(user)
    res.json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email, role: user.role, image: user.image, createdAt: user.createdAt } })
  } catch (error) {
    console.log(error.message)
    res.json({ success: false, message: error.message })
  }
}

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.json({ success: false, message: 'User not found' })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.json({ success: false, message: 'Current password is incorrect' })
    }

    if (!newPassword || newPassword.length < 8) {
      return res.json({ success: false, message: 'New password must be at least 8 characters long' })
    }

    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'New password and confirm password must match' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // Use findByIdAndUpdate to avoid full document validation on non-required fields
    await User.findByIdAndUpdate(req.user._id, {
      password: hashedPassword
    }, { new: true, runValidators: false })

    res.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.log(error.message)
    res.json({ success: false, message: error.message })
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.json({ success: false, message: 'Email is required' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = token
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000
    await user.save()

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    const resetLink = `${clientUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`

    const transporter = createTransporter()
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Rento Password Reset',
      html: `<p>Hello ${user.name},</p><p>Click the link below to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, please ignore this email.</p>`
    })

    res.json({ success: true, message: 'Password reset link sent to your email' })
  } catch (error) {
    console.log(error.message)
    res.json({ success: false, message: error.message })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword, confirmPassword } = req.body
    if (!email || !token || !newPassword || !confirmPassword) {
      return res.json({ success: false, message: 'All fields are required' })
    }

    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'Passwords do not match' })
    }

    const user = await User.findOne({ email, resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } })
    if (!user) {
      return res.json({ success: false, message: 'Reset link is invalid or has expired' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // Use findByIdAndUpdate to avoid full document validation on non-required fields
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      resetPasswordToken: '',
      resetPasswordExpires: null
    }, { new: true, runValidators: false })

    res.json({ success: true, message: 'Password has been reset successfully' })
  } catch (error) {
    console.log(error.message)
    res.json({ success: false, message: error.message })
  }
}

import express from 'express'
import { protect, admin } from '../middleware/auth.js'
import {
  loginAdmin,
  getDashboardStats,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllCars,
  getPendingCars,
  approveCar,
  rejectCar,
  getAllBookings,
  confirmBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  rejectBooking,
} from '../controllers/adminController.js'

const router = express.Router()

router.post('/login', loginAdmin)
router.get('/dashboard', protect, admin, getDashboardStats)
router.get('/users', protect, admin, getAllUsers)
router.put('/users/:id/role', protect, admin, updateUserRole)
router.delete('/users/:id', protect, admin, deleteUser)
router.get('/cars', protect, admin, getAllCars)
router.get('/pending-cars', protect, admin, getPendingCars)
router.put('/car/approve/:id', protect, admin, approveCar)
router.patch('/car/reject/:id', protect, admin, rejectCar)
router.get('/bookings', protect, admin, getAllBookings)
router.patch('/booking/confirm/:id', protect, admin, confirmBooking)
router.patch('/booking/start/:id', protect, admin, startBooking)
router.patch('/booking/complete/:id', protect, admin, completeBooking)
router.patch('/booking/cancel/:id', protect, admin, cancelBooking)
router.patch('/booking/reject/:id', protect, admin, rejectBooking)

export default router

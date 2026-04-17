import express from "express";
import { changeBookingStatus, checkAvailabilityOfCar, createBooking, getOwnerBookings, getUserBookings, payBooking, cancelUserBooking, rejectOwnerBooking, uploadDocuments } from "../controllers/bookingController.js";
import { protect } from "../middleware/auth.js";
import upload from "../middleware/multer.js";

const bookingRouter = express.Router();

bookingRouter.post('/check-availability', checkAvailabilityOfCar)
bookingRouter.post('/create', protect, createBooking)
bookingRouter.post('/upload-documents', protect, upload.array('documents'), uploadDocuments)
bookingRouter.get('/user', protect, getUserBookings)
bookingRouter.get('/owner', protect, getOwnerBookings)
bookingRouter.post('/change-status', protect, changeBookingStatus)
bookingRouter.patch('/payment/:id', protect, payBooking)
bookingRouter.patch('/cancel/:id', protect, cancelUserBooking)
bookingRouter.patch('/reject/:id', protect, rejectOwnerBooking)

export default bookingRouter;
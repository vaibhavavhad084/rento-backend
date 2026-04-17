import express from "express";
import { createOrder, verifyPayment } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";

const paymentRouter = express.Router();

// Create Razorpay Order
paymentRouter.post('/create-order', protect, createOrder);

// Verify Payment and Create Booking
paymentRouter.post('/verify', protect, verifyPayment);

export default paymentRouter;

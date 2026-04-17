import Razorpay from 'razorpay'
import User from "../models/User.js";
import Car from "../models/Car.js";
import Booking from "../models/Booking.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { sendBookingConfirmationEmail, sendBookingEmail } from './notificationController.js'
import { sendCarApprovalEmail, sendCarRejectionEmail } from './notificationController.js'

// Generate JWT Token
const generateToken = (userId, role)=>{
    const payload = { id: userId, role }
    return jwt.sign(payload, process.env.JWT_SECRET)
}

const updateCarAvailability = async (carId, available) => {
  const car = await Car.findById(carId)
  if (!car) return
  car.isAvaliable = available
  await car.save()
}

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  })
}

const applyRefundToBooking = async (booking) => {
  booking.refundStatus = 'processed'
  booking.refundAmount = booking.price || 0
  booking.refundDate = new Date()

  if (booking.paymentId) {
    const razorpay = getRazorpayInstance()
    if (razorpay) {
      try {
        await razorpay.payments.refund(booking.paymentId, { amount: Math.round((booking.price || 0) * 100) })
      } catch (error) {
        console.error('Admin Razorpay refund failed:', error.message)
      }
    }
  }
}

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) {
      return res.json({ success: false, message: "Admin not found" })
    }
    if (user.role !== 'admin') {
      return res.json({ success: false, message: "Access denied. Not an admin." })
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid Credentials" })
    }
    const token = generateToken(user._id.toString(), user.role)
    res.json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email, role: user.role, image: user.image, createdAt: user.createdAt } })
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message })
  }
}

export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCars = await Car.countDocuments();
    const totalBookings = await Booking.countDocuments();

    // Calculate monthly revenue (paid bookings in current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyBookings = await Booking.find({
      paymentStatus: 'paid',
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const monthlyRevenue = monthlyBookings.reduce((sum, booking) => sum + booking.price, 0);

    res.json({
      success: true,
      stats: { totalUsers, totalCars, totalBookings, monthlyRevenue },
    });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["user", "owner", "admin"].includes(role)) {
      return res.json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select("-password");
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user, message: 'User role updated' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getAllCars = async (req, res) => {
  try {
    const cars = await Car.find()
      .populate('owner', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, cars });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getPendingCars = async (req, res) => {
  try {
    const cars = await Car.find({ isApproved: false })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, cars });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const approveCar = async (req, res) => {
  try {
    const { id } = req.params;
    const car = await Car.findById(id).populate('owner', 'email');
    if (!car) {
      return res.json({ success: false, message: 'Car not found' });
    }
    car.isApproved = true;
    await car.save();

    // Send car approval email to owner
    try {
      if (car.owner && car.owner.email) {
        const carDetails = {
          brand: car.brand,
          model: car.model,
          price: car.pricePerDay
        };
        const emailResult = await sendCarApprovalEmail(car.owner.email, carDetails);
        console.log('Car approval email result:', emailResult);
      }
    } catch (emailError) {
      console.error('Error sending car approval email:', emailError.message);
      // Don't fail the car approval if email fails
    }

    res.json({ success: true, message: 'Car approved' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const rejectCar = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.json({ success: false, message: "Rejection reason is required" });
    }

    const car = await Car.findById(id).populate('owner', 'email');
    if (!car) {
      return res.json({ success: false, message: 'Car not found' });
    }

    // Send car rejection email to owner before deleting
    try {
      if (car.owner && car.owner.email) {
        const carDetails = {
          brand: car.brand,
          model: car.model,
          price: car.pricePerDay
        };
        const emailResult = await sendCarRejectionEmail(car.owner.email, carDetails, reason);
        console.log('Car rejection email result:', emailResult);
      }
    } catch (emailError) {
      console.error('Error sending car rejection email:', emailError.message);
      // Don't fail the car rejection if email fails
    }

    await car.deleteOne();
    res.json({ success: true, message: 'Car rejected and deleted' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'name email role')
      .populate('car', 'brand model pricePerDay image isApproved')
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('car user');
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    if (booking.paymentStatus !== 'paid') {
      return res.json({ success: false, message: 'Payment must be completed before confirming' });
    }
    if (booking.status !== 'pending') {
      return res.json({ success: false, message: 'Only pending bookings can be confirmed' });
    }
    booking.status = 'confirmed';
    await updateCarAvailability(booking.car._id, false);
    await booking.save();

    // Send email notification to user
    try {
      if (booking.user && booking.user.email) {
        const bookingDetails = {
          carName: booking.car.name,
          pickupDate: new Date(booking.pickupDate).toLocaleDateString(),
          returnDate: new Date(booking.returnDate).toLocaleDateString(),
          totalAmount: booking.price
        };

        const emailResult = await sendBookingConfirmationEmail(booking.user.email, bookingDetails);
        console.log('Admin booking confirmation email result:', emailResult);

        // Log email in booking
        booking.emailLogs.push({ type: 'booking_confirmed' });
        await booking.save();
      }
    } catch (emailError) {
      console.error('Error sending admin booking confirmation email:', emailError.message);
      // Don't fail the booking confirmation if email fails
    }

    res.json({ success: true, message: 'Booking confirmed' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const booking = await Booking.findById(id).populate('car user');
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    if (booking.status === 'completed') {
      return res.json({ success: false, message: 'Completed bookings cannot be rejected' });
    }
    if (booking.status === 'rejected') {
      return res.json({ success: true, message: 'Booking already rejected' });
    }

    booking.status = 'rejected';
    await updateCarAvailability(booking.car._id, true);
    await applyRefundToBooking(booking);

    try {
      if (booking.user && booking.user.email) {
        await sendBookingEmail(booking, 'rejected', reason || 'Booking rejected by admin');
        booking.emailLogs.push({ type: 'booking_rejected' });
      }
    } catch (emailError) {
      console.error('Error sending admin booking rejection email:', emailError.message);
    }

    await booking.save();
    res.json({ success: true, message: 'Booking rejected and refund processed' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const startBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'confirmed') {
      return res.json({ success: false, message: 'Only confirmed bookings can be started' });
    }
    booking.status = 'ongoing';
    await booking.save();
    res.json({ success: true, message: 'Trip started' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('car');
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'ongoing') {
      return res.json({ success: false, message: 'Only ongoing trips can be completed' });
    }
    booking.status = 'completed';
    await updateCarAvailability(booking.car._id, true);
    await booking.save();
    res.json({ success: true, message: 'Booking completed' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('car user');
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    if (booking.status === 'completed') {
      return res.json({ success: false, message: 'Completed bookings cannot be cancelled' });
    }
    if (booking.status === 'cancelled') {
      return res.json({ success: true, message: 'Booking already cancelled' });
    }
    booking.status = 'cancelled';
    if (booking.car) {
      await updateCarAvailability(booking.car._id, true);
    }
    await applyRefundToBooking(booking);

    try {
      if (booking.user && booking.user.email) {
        await sendBookingEmail(booking, 'cancelled', 'Booking cancelled by admin');
        booking.emailLogs.push({ type: 'booking_cancelled' });
      }
    } catch (emailError) {
      console.error('Error sending admin booking cancel email:', emailError.message);
    }

    await booking.save();
    res.json({ success: true, message: 'Booking cancelled and refund processed' });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

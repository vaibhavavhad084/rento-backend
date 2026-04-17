import mongoose from "mongoose";
const {ObjectId} = mongoose.Schema.Types

const bookingSchema = new mongoose.Schema({
    car: {type: ObjectId, ref: "Car", required: true},
    user: {type: ObjectId, ref: "User", required: true},
    owner: {type: ObjectId, ref: "User", required: true},
    pickupDate: {type: Date, required: true},
    returnDate: {type: Date, required: true},
    status: {type: String, enum: ["pending", "confirmed", "ongoing", "completed", "cancelled", "rejected"], default: "pending"},
    paymentStatus: {type: String, enum: ["pending", "paid"], default: "pending"},
    price: {type: Number, required: true},
    documents: [{
      type: { type: String },
      url: { type: String },
      name: { type: String }
    }],
    emailLogs: [{
      type: { type: String }, // booking_confirmed, booking_rejected, etc
      sentAt: { type: Date, default: Date.now }
    }],
    paymentId: {type: String},
    orderId: {type: String},
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'processed'],
      default: 'none'
    },
    refundAmount: { type: Number, default: 0 },
    refundDate: { type: Date }
},{timestamps: true})

const Booking = mongoose.model('Booking', bookingSchema)

export default Booking
import Razorpay from 'razorpay'
import Booking from "../models/Booking.js"
import Car from "../models/Car.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import { sendBookingEmail } from "./notificationController.js";

// Function to Check Availability of Car for a given Date
const checkAvailability = async (car, pickupDate, returnDate)=>{
    const bookings = await Booking.find({
        car,
        pickupDate: {$lte: returnDate},
        returnDate: {$gte: pickupDate},
    })
    return bookings.length === 0;
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

const processRefund = async (booking) => {
    if (!booking || !booking.paymentId) {
        return { success: false, message: 'No payment id available for refund' }
    }

    const razorpay = getRazorpayInstance()
    if (!razorpay) {
        return { success: false, message: 'Razorpay not configured' }
    }

    const amount = Math.round((booking.price || 0) * 100)
    try {
        const refundResult = await razorpay.payments.refund(booking.paymentId, { amount })
        return { success: true, refundResult }
    } catch (error) {
        console.error('Razorpay refund failed:', error.message)
        return { success: false, message: error.message }
    }
}

const applyRefund = async (booking) => {
    booking.refundStatus = 'processed'
    booking.refundAmount = booking.price || 0
    booking.refundDate = new Date()

    if (booking.paymentId) {
        await processRefund(booking)
    }

    // Deduct refund amount from vendor and admin revenue
    if (booking.refundAmount && booking.refundAmount > 0) {
        try {
            // Deduct from vendor/owner revenue
            if (booking.owner) {
                await User.findByIdAndUpdate(
                    booking.owner,
                    { $inc: { totalRefunded: booking.refundAmount } },
                    { new: true }
                )
            }

            // Deduct from admin revenue (admin gets commission/cut)
            const admin = await User.findOne({ role: 'admin' })
            if (admin) {
                await User.findByIdAndUpdate(
                    admin._id,
                    { $inc: { totalRefunded: booking.refundAmount } },
                    { new: true }
                )
            }
        } catch (error) {
            console.error('Error updating refund in user revenue:', error.message)
        }
    }
}

// API to Check Availability of Cars for the given Date and location
export const checkAvailabilityOfCar = async (req, res)=>{
    try {
        const {location, pickupDate, returnDate} = req.body

        // fetch all available cars for the given location
        const cars = await Car.find({location, isAvaliable: true})

        // check car availability for the given date range using promise
        const availableCarsPromises = cars.map(async (car)=>{
           const isAvailable = await checkAvailability(car._id, pickupDate, returnDate)
           return {...car._doc, isAvailable: isAvailable}
        })

        let availableCars = await Promise.all(availableCarsPromises);
        availableCars = availableCars.filter(car => car.isAvailable === true)

        res.json({success: true, availableCars})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to Create Booking
export const createBooking = async (req, res)=>{
    try {
        const {_id} = req.user;
        const {car, pickupDate, returnDate, paymentStatus = 'pending', paymentId, orderId, documents} = req.body;

        const isAvailable = await checkAvailability(car, pickupDate, returnDate)
        if(!isAvailable){
            return res.json({success: false, message: "Car is not available"})
        }

        const carData = await Car.findById(car)

        // Calculate price based on pickupDate and returnDate
        const picked = new Date(pickupDate);
        const returned = new Date(returnDate);
        const noOfDays = Math.ceil((returned - picked) / (1000 * 60 * 60 * 24))
        const price = carData.pricePerDay * noOfDays;

        await Booking.create({
          car,
          owner: carData.owner,
          user: _id,
          pickupDate,
          returnDate,
          price,
          status: 'pending',
          paymentStatus,
          paymentId,
          orderId,
          documents
        })

        res.json({success: true, message: "Booking Created"})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to List User Bookings 
export const getUserBookings = async (req, res)=>{
    try {
        const {_id} = req.user;
        const bookings = await Booking.find({ user: _id }).populate("car").sort({createdAt: -1})
        res.json({success: true, bookings})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

export const payBooking = async (req, res) => {
    try {
        const { id } = req.params
        const {_id} = req.user
        const booking = await Booking.findById(id)
        if(!booking){
            return res.json({success: false, message: 'Booking not found'})
        }
        if(booking.user.toString() !== _id.toString()){
            return res.json({success: false, message: 'Unauthorized'})
        }
        if(booking.paymentStatus === 'paid'){
            return res.json({success: true, message: 'Booking already paid'})
        }
        booking.paymentStatus = 'paid'
        await booking.save()
        res.json({success: true, message: 'Payment successful'})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

export const cancelUserBooking = async (req, res) => {
    try {
        const { id } = req.params
        const {_id} = req.user
        const booking = await Booking.findById(id)
        if(!booking){
            return res.json({success: false, message: 'Booking not found'})
        }
        if(booking.user.toString() !== _id.toString()){
            return res.json({success: false, message: 'Unauthorized'})
        }
        if(booking.status !== 'pending'){
            return res.json({success: false, message: 'Only pending bookings can be cancelled'})
        }
        booking.status = 'cancelled'
        await updateCarAvailability(booking.car, true)
        await applyRefund(booking)

        try {
            const userBooking = await Booking.findById(id).populate('user car')
            if (userBooking && userBooking.user) {
                await sendBookingEmail(userBooking, 'cancelled', 'Booking cancelled by user')
                booking.emailLogs.push({ type: 'booking_cancelled' })
            }
        } catch (emailError) {
            console.error('Error sending booking cancellation email:', emailError.message)
        }

        await booking.save()
        res.json({success: true, message: 'Booking cancelled and refund processed'})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

export const rejectOwnerBooking = async (req, res) => {
    try {
        const { id } = req.params
        const { reason } = req.body
        const {_id, role} = req.user
        if (role !== 'owner') {
            return res.json({ success: false, message: 'Unauthorized' })
        }

        const booking = await Booking.findById(id)
        if (!booking) {
            return res.json({ success: false, message: 'Booking not found' })
        }
        if (booking.owner.toString() !== _id.toString()) {
            return res.json({ success: false, message: 'Unauthorized' })
        }
        if (booking.status === 'completed') {
            return res.json({ success: false, message: 'Completed bookings cannot be rejected' })
        }
        if (booking.status === 'rejected') {
            return res.json({ success: true, message: 'Booking already rejected' })
        }

        booking.status = 'rejected'
        await updateCarAvailability(booking.car, true)
        await applyRefund(booking)

        try {
            const userBooking = await Booking.findById(id).populate('user car')
            if (userBooking && userBooking.user) {
                await sendBookingEmail(userBooking, 'rejected', reason || 'Booking rejected by owner')
                booking.emailLogs.push({ type: 'booking_rejected' })
            }
        } catch (emailError) {
            console.error('Error sending owner rejection email:', emailError.message)
        }

        await booking.save()
        res.json({ success: true, message: 'Booking rejected and refund processed' })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// API to get Owner Bookings
export const getOwnerBookings = async (req, res)=>{
    try {
        if(req.user.role !== 'owner'){
            return res.json({ success: false, message: "Unauthorized" })
        }
        const bookings = await Booking.find({owner: req.user._id}).populate('car user').select("-user.password").sort({createdAt: -1 })
        res.json({success: true, bookings})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to change booking status
export const changeBookingStatus = async (req, res)=>{
    try {
        const {_id, role} = req.user;
        const {bookingId, status, reason} = req.body

        const booking = await Booking.findById(bookingId).populate('car')
        if(!booking){
            return res.json({ success: false, message: "Booking not found"})
        }
        if(role !== 'admin' && booking.owner.toString() !== _id.toString()){
            return res.json({ success: false, message: "Unauthorized"})
        }

        if(status === 'confirmed'){
            if(booking.paymentStatus !== 'paid'){
                return res.json({ success: false, message: "Payment must be completed before confirming"})
            }
            if(booking.status !== 'pending'){
                return res.json({ success: false, message: "Only pending bookings can be confirmed"})
            }
            booking.status = 'confirmed'
            await updateCarAvailability(booking.car._id, false)

            // Save booking first
            await booking.save()

            // Send notifications to user
            try {
                const userBooking = await Booking.findById(bookingId).populate('user car')
                if(userBooking && userBooking.user) {
                    const bookingDetails = {
                        carName: userBooking.car.name,
                        pickupDate: new Date(userBooking.pickupDate).toLocaleDateString(),
                        returnDate: new Date(userBooking.returnDate).toLocaleDateString(),
                        totalAmount: userBooking.price
                    }

                    // Send Email notification
                    const emailResult = await sendBookingConfirmationEmail(userBooking.user.email, bookingDetails)
                    console.log('Email notification result:', emailResult)

                    // Log email in booking
                    booking.emailLogs.push({ type: 'booking_confirmed' })
                    await booking.save()
                }
            } catch (emailError) {
                console.error('Error sending booking confirmation email:', emailError.message)
            }
            // Don't return here - email sending should not block the response
        } else if(status === 'ongoing'){
            if(booking.status !== 'confirmed'){
                return res.json({ success: false, message: "Only confirmed bookings can be started"})
            }
            booking.status = 'ongoing'
        } else if(status === 'completed'){
            if(booking.status !== 'ongoing'){
                return res.json({ success: false, message: "Only ongoing trips can be completed"})
            }
            booking.status = 'completed'
            await updateCarAvailability(booking.car._id, true)

            // Add revenue to vendor and admin when booking completes successfully
            if (booking.price && booking.price > 0) {
                try {
                    // Add revenue to vendor/owner
                    if (booking.owner) {
                        await User.findByIdAndUpdate(
                            booking.owner,
                            { $inc: { totalRevenue: booking.price } },
                            { new: true }
                        )
                    }

                    // Add revenue to admin
                    const admin = await User.findOne({ role: 'admin' })
                    if (admin) {
                        await User.findByIdAndUpdate(
                            admin._id,
                            { $inc: { totalRevenue: booking.price } },
                            { new: true }
                        )
                    }
                } catch (error) {
                    console.error('Error updating revenue:', error.message)
                }
            }
        } else if(status === 'cancelled'){
            if(booking.status === 'completed'){
                return res.json({ success: false, message: "Completed bookings cannot be cancelled"})
            }
            if(booking.status === 'cancelled'){
                return res.json({ success: true, message: 'Booking already cancelled' });
            }
            booking.status = 'cancelled'
            await updateCarAvailability(booking.car._id, true)
            await applyRefund(booking)

            try {
                const userBooking = await Booking.findById(bookingId).populate('user car')
                if(userBooking && userBooking.user) {
                    await sendBookingEmail(userBooking, 'cancelled', reason || 'Booking cancelled by owner')
                    booking.emailLogs.push({ type: 'booking_cancelled' })
                }
            } catch (emailError) {
                console.error('Error sending booking cancellation email:', emailError.message)
            }
        } else if(status === 'rejected'){
            if(booking.status === 'completed'){
                return res.json({ success: false, message: "Completed bookings cannot be rejected"})
            }
            if(booking.status === 'rejected'){
                return res.json({ success: true, message: 'Booking already rejected' });
            }
            booking.status = 'rejected'
            await updateCarAvailability(booking.car._id, true)
            await applyRefund(booking)

            try {
                const userBooking = await Booking.findById(bookingId).populate('user car')
                if(userBooking && userBooking.user) {
                    await sendBookingEmail(userBooking, 'rejected', reason || 'Booking rejected by owner')
                    booking.emailLogs.push({ type: 'booking_rejected' })
                }
            } catch (emailError) {
                console.error('Error sending booking rejection email:', emailError.message)
            }
        } else {
            return res.json({ success: false, message: "Invalid booking status"})
        }

        if(status !== 'confirmed') {
            await booking.save();
        }

        res.json({ success: true, message: "Status Updated"})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to upload documents
export const uploadDocuments = async (req, res) => {
    try {
        const files = req.files;
        const documentTypes = req.body.documentTypes;

        if (!files || files.length === 0) {
            return res.json({ success: false, message: "No files uploaded" });
        }

        const typeList = Array.isArray(documentTypes)
            ? documentTypes
            : documentTypes
                ? [documentTypes]
                : [];

        const uploadPromises = files.map(async (file, index) => {
            const type = typeList[index] || 'document';
            const result = await imagekit.upload({
                file: file.buffer,
                fileName: file.originalname,
                folder: "/documents"
            });
            return {
                type,
                url: result.url,
                name: file.originalname
            };
        });

        const uploadedDocuments = await Promise.all(uploadPromises);

        res.json({ success: true, documents: uploadedDocuments });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};
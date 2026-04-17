import Razorpay from 'razorpay';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';

// Initialize Razorpay instance (lazy initialization)
const getRazorpayInstance = () => {
    console.log('Initializing Razorpay with KEY_ID:', process.env.RAZORPAY_KEY_ID);
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not found in environment variables');
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
};

// Check car availability
const checkAvailability = async (car, pickupDate, returnDate) => {
    const bookings = await Booking.find({
        car,
        pickupDate: { $lte: returnDate },
        returnDate: { $gte: pickupDate },
        status: { $nin: ['cancelled'] }
    });
    return bookings.length === 0;
};

// Create Razorpay Order
export const createOrder = async (req, res) => {
    try {
        let { amount, carId, pickupDate, returnDate } = req.body;
        const user = req.user;
        const userId = user ? String(user._id) : null;

        if (!user || !userId) {
            console.error('Payment createOrder failed: user not authenticated');
            return res.json({ success: false, message: 'Authentication failed' });
        }

        if (!amount || !carId || !pickupDate || !returnDate) {
            console.error('Payment createOrder failed: missing fields');
            return res.json({ success: false, message: 'Missing required fields' });
        }

        // Validate and normalize amount
        let floatAmount = parseFloat(amount);
        if (isNaN(floatAmount) || floatAmount <= 0) {
            console.error('Invalid amount:', req.body.amount, 'Type:', typeof amount);
            return res.json({ success: false, message: 'Invalid payment amount' });
        }

        // Round amount to 2 decimal places (paise)
        floatAmount = Math.round(floatAmount * 100) / 100;
        
        // In test mode, Razorpay typically has a ₹50,000 limit per transaction
        // Check if using test keys
        const isTestMode = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID.includes('test');
        if (isTestMode) {
            const TEST_MODE_LIMIT = 50000; // ₹50,000 limit in test mode
            if (floatAmount > TEST_MODE_LIMIT) {
                console.error(`Test mode amount limit: ${floatAmount} exceeds ₹${TEST_MODE_LIMIT}`);
                return res.json({ 
                    success: false, 
                    message: `Test mode limit: Maximum ₹${TEST_MODE_LIMIT}. Requested: ₹${floatAmount}`,
                    testModeLimit: TEST_MODE_LIMIT,
                    requestedAmount: floatAmount
                });
            }
        }

        // Ensure amount is at least ₹1
        if (floatAmount < 1) {
            return res.json({ success: false, message: 'Amount must be at least ₹1' });
        }
        
        amount = floatAmount;

        const isAvailable = await checkAvailability(carId, pickupDate, returnDate);
        if (!isAvailable) {
            return res.json({ success: false, message: 'Car is not available for selected dates' });
        }

        try {
            // Get Razorpay instance
            const razorpay = getRazorpayInstance();

            // Create Razorpay order - amount should be in paise (1 rupee = 100 paise)
            const orderAmount = Math.round(amount * 100); // Convert to paise
            
            // Validate amount is within integer range
            if (!Number.isInteger(orderAmount)) {
                console.error('Order amount is not an integer:', orderAmount);
                return res.json({ success: false, message: 'Invalid amount calculation' });
            }
            
            const roundedRupees = orderAmount / 100;
            console.log(` Creating Razorpay order:`);
            console.log(`   Amount (₹): ${amount}`);
            console.log(`   Amount (paise): ${orderAmount}`);
            console.log(`   Type check: ${typeof orderAmount}`);

            // Create a shorter receipt (max 40 chars for Razorpay)
            const timestamp = Date.now().toString().slice(-8);
            const shortUserId = userId.slice(-6);
            const receipt = `order_${shortUserId}_${timestamp}`.slice(0, 40);
            
            const order = await razorpay.orders.create({
                amount: orderAmount,
                currency: 'INR',
                receipt: receipt,
                payment_capture: 1
            });

            console.log(' Razorpay order created:', order.id);

            res.json({
                success: true,
                order: {
                    id: order.id,
                    amount: order.amount,
                    currency: order.currency
                }
            });
        } catch (razorpayError) {
            console.error(' Razorpay Error:');
            console.error('   Status Code:', razorpayError.statusCode);
            console.error('   Message:', razorpayError.message);
            console.error('   Error:', razorpayError.error);
            
            let errorMessage = 'Razorpay API Error: ' + (razorpayError.message || 'Unknown error');
            
            // Handle specific Razorpay errors
            if (razorpayError.message && razorpayError.message.includes('exceeds')) {
                console.error(' Amount exceeds error - likely test mode limitation');
                errorMessage = `Amount ₹${amount} may exceed test mode limits. Try a smaller amount.`;
            } else if (razorpayError.statusCode === 400) {
                console.error(' 400 Bad request - possible amount format issue');
                errorMessage = 'Invalid payment request. Amount may be incorrectly formatted.';
            }
            
            return res.json({ 
                success: false, 
                message: errorMessage,
                details: razorpayError.message
            });
        }
    } catch (error) {
        console.error(' Unexpected Error:', error.message);
        res.json({ success: false, message: 'Server error: ' + error.message });
    }
};

// Verify Payment and Create Booking
export const verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            carId,
            pickupDate,
            returnDate,
            documents
        } = req.body;

        const { _id: userId } = req.user;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.json({ success: false, message: 'Missing payment details' });
        }

        // Verify Razorpay signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.json({ success: false, message: 'Payment verification failed' });
        }

        // Check car availability again before creating booking
        const isAvailable = await checkAvailability(carId, pickupDate, returnDate);
        if (!isAvailable) {
            return res.json({ success: false, message: 'Car is not available for selected dates' });
        }

        // Get car details
        const car = await Car.findById(carId);
        if (!car) {
            return res.json({ success: false, message: 'Car not found' });
        }

        // Calculate price
        const picked = new Date(pickupDate);
        const returned = new Date(returnDate);
        const noOfDays = Math.ceil((returned - picked) / (1000 * 60 * 60 * 24));
        const price = car.pricePerDay * noOfDays;

        // Create booking
        const booking = await Booking.create({
            car: carId,
            user: userId,
            owner: car.owner,
            pickupDate,
            returnDate,
            price,
            status: 'pending',
            paymentStatus: 'paid',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            documents: documents || []
        });

        res.json({
            success: true,
            message: 'Payment verified and booking created',
            booking
        });
    } catch (error) {
        console.log('Error in verifyPayment:', error.message);
        res.json({ success: false, message: error.message });
    }
};

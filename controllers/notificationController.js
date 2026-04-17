import nodemailer from 'nodemailer'

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
})

// Verify transporter configuration
emailTransporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter verification failed:', error.message)
        console.error('Gmail Setup Required:')
        console.error('   1. Enable 2FA on Gmail account')
        console.error('   2. Generate App Password: https://support.google.com/accounts/answer/185833')
        console.error('   3. Update GMAIL_APP_PASSWORD in .env with the 16-character code')
    } else {
        console.log('Email transporter is ready to send emails')
    }
})

// Send Email notification
export const sendEmail = async (to, subject, html) => {
    try {
        if (!to) {
            console.error('Email recipient (to) is missing')
            return { success: false, error: 'Recipient email is missing' }
        }

        console.log(`Preparing to send email to: ${to}`)
        
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: to,
            subject: subject,
            html: html
        }

        const result = await emailTransporter.sendMail(mailOptions)
        console.log('Email sent successfully:', result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error('Email sending failed:', error.message)
        console.error('Error details:', error)
        return { success: false, error: error.message }
    }
}

export const sendBookingEmail = async (booking, status, reason = '') => {
    const userName = booking.user?.name || 'Customer'
    const email = booking.user?.email || ''
    const car = booking.car || {}
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
    const refundAmount = booking.refundAmount || 0
    const refundDate = booking.refundDate ? new Date(booking.refundDate).toLocaleDateString() : 'N/A'
    const paymentId = booking.paymentId || 'N/A'
    const subject = 'Booking Update - Car Rental'

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7FFF00;">Booking Update</h2>
            <p>Hello ${userName},</p>
            <p>Your booking has been <strong>${statusLabel}</strong>.</p>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-bottom: 10px;">🚗 Car Details:</h3>
                <p><strong>Name:</strong> ${car.brand || ''} ${car.model || ''}</p>
                <p><strong>Location:</strong> ${car.location || 'N/A'}</p>
                <p><strong>Category:</strong> ${car.category || 'N/A'}</p>
                <p><strong>Price/Day:</strong> ₹${car.pricePerDay ?? 'N/A'}</p>
                ${car.image ? `<div style="margin-top: 12px;"><img src="${car.image}" alt="${car.brand || ''} ${car.model || ''}" style="width:100%; max-width:280px; border-radius:8px;"/></div>` : ''}
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px;">📅 Booking Details:</h3>
                <p><strong>Booking ID:</strong> ${booking._id}</p>
                <p><strong>Pickup:</strong> ${new Date(booking.pickupDate).toLocaleDateString()}</p>
                <p><strong>Return:</strong> ${new Date(booking.returnDate).toLocaleDateString()}</p>
                <p><strong>Total:</strong> ₹${booking.price}</p>
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px;">💳 Payment:</h3>
                <p><strong>Payment ID:</strong> ${paymentId}</p>
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin-bottom: 10px;">📌 Action Details:</h3>
                <p><strong>Status:</strong> ${statusLabel}</p>
                ${refundAmount ? `<p><strong>Refund Amount:</strong> ₹${refundAmount}</p>` : ''}
                ${booking.refundDate ? `<p><strong>Refund Date:</strong> ${refundDate}</p>` : ''}
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            </div>

            <p>Thank you for using our service.</p>

            <p style="color: #666; font-size: 12px;">If you have any questions, please contact our support team.</p>
        </div>
    `

    return await sendEmail(email, subject, html)
}

// Send booking confirmation Email
export const sendBookingConfirmationEmail = async (email, bookingDetails) => {
    const subject = ' Your Car Rental Booking is Confirmed!'

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7FFF00;">Booking Confirmation</h2>
            <p>Dear Customer,</p>
            <p>Your car rental booking has been confirmed successfully!</p>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>Booking Details:</h3>
                <p><strong>Car:</strong> ${bookingDetails.carName}</p>
                <p><strong>Pickup Date:</strong> ${bookingDetails.pickupDate}</p>
                <p><strong>Return Date:</strong> ${bookingDetails.returnDate}</p>
                <p><strong>Total Amount:</strong> ₹${bookingDetails.totalAmount}</p>
                <p><strong>Payment Status:</strong> Paid</p>
            </div>

            <p>Please arrive at the pickup location 15 minutes before your scheduled time.</p>
            <p>Thank you for choosing our service!</p>

            <p style="color: #666; font-size: 12px;">
                If you have any questions, please contact our support team.
            </p>
        </div>
    `

    return await sendEmail(email, subject, html)
}

// Send KYC Approval Email
export const sendKYCApprovalEmail = async (email) => {
    const subject = 'KYC Approved'

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7FFF00;">Congratulations! Your KYC is Approved</h2>
            <p>Dear User,</p>
            <p>We are pleased to inform you that your KYC verification has been successfully approved!</p>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>What you can do now:</h3>
                <ul>
                    <li>List your cars for rent</li>
                    <li>Manage your car listings</li>
                    <li>Receive booking requests from customers</li>
                    <li>Earn money by renting out your vehicles</li>
                </ul>
            </div>

            <p>Start by adding your first car to our platform!</p>
            <p>Welcome to our car owner community!</p>

            <p style="color: #666; font-size: 12px;">
                If you have any questions, please contact our support team.
            </p>
        </div>
    `

    return await sendEmail(email, subject, html)
}

// Send KYC Rejection Email
export const sendKYCRejectionEmail = async (email, reason) => {
    const subject = 'KYC Rejected '

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B6B;">KYC Verification Rejected</h2>
            <p>Dear User,</p>
            <p>We regret to inform you that your KYC verification could not be approved at this time.</p>

            <div style="background-color: #ffeaea; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF6B6B;">
                <h3>Reason for Rejection:</h3>
                <p style="color: #d63031; font-weight: bold;">${reason}</p>
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>Steps to Resubmit:</h3>
                <ol>
                    <li>Review the rejection reason above</li>
                    <li>Prepare corrected documents</li>
                    <li>Ensure all documents are clear and valid</li>
                    <li>Submit your KYC again through the platform</li>
                </ol>
            </div>

            <p>We encourage you to resubmit with the corrected information.</p>

            <p style="color: #666; font-size: 12px;">
                If you have any questions, please contact our support team.
            </p>
        </div>
    `

    return await sendEmail(email, subject, html)
}

// Send Car Approval Email
export const sendCarApprovalEmail = async (email, carDetails) => {
    const subject = 'Car Approved'

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7FFF00;">Your Car Listing is Approved!</h2>
            <p>Dear Car Owner,</p>
            <p>Great news! Your car listing has been approved and is now visible to customers.</p>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>Car Details:</h3>
                <p><strong>Car:</strong> ${carDetails.brand} ${carDetails.model}</p>
                <p><strong>Price per Day:</strong> ₹${carDetails.price}</p>
            </div>

            <p>Your car is now live on our platform and customers can start booking it!</p>
            <p>You will receive booking notifications when customers show interest.</p>

            <p style="color: #666; font-size: 12px;">
                If you have any questions, please contact our support team.
            </p>
        </div>
    `

    return await sendEmail(email, subject, html)
}

// Send Car Rejection Email
export const sendCarRejectionEmail = async (email, carDetails, reason) => {
    const subject = 'Car Rejected'

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B6B;">Car Listing Rejected</h2>
            <p>Dear Car Owner,</p>
            <p>We regret to inform you that your car listing could not be approved at this time.</p>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>Car Details:</h3>
                <p><strong>Brand:</strong> ${carDetails.brand}</p>
                <p><strong>Model:</strong> ${carDetails.model}</p>
                <p><strong>Price per Day:</strong> ₹${carDetails.price}</p>
            </div>

            <div style="background-color: #ffeaea; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF6B6B;">
                <h3>Reason for Rejection:</h3>
                <p style="color: #d63031; font-weight: bold;">${reason}</p>
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>Suggestions:</h3>
                <ul>
                    <li>Review the rejection reason and make necessary corrections</li>
                    <li>Ensure all car details are accurate</li>
                    <li>Upload clear, high-quality photos</li>
                    <li>Verify that your car meets our listing requirements</li>
                </ul>
            </div>

            <p>Please fix the issues and resubmit your car listing.</p>

            <p style="color: #666; font-size: 12px;">
                If you have any questions, please contact our support team.
            </p>
        </div>
    `

    return await sendEmail(email, subject, html)
}

// Send Booking Rejection Email
export const sendBookingRejectionEmail = async (email, bookingDetails, reason) => {
    const subject = 'Booking Rejected'

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B6B;">Booking Request Rejected</h2>
            <p>Dear Customer,</p>
            <p>We regret to inform you that your booking request has been rejected.</p>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>Booking Details:</h3>
                <p><strong>Car:</strong> ${bookingDetails.carName}</p>
                <p><strong>Requested Dates:</strong> ${bookingDetails.pickupDate} to ${bookingDetails.returnDate}</p>
            </div>

            <div style="background-color: #ffeaea; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF6B6B;">
                <h3>Reason for Rejection:</h3>
                <p style="color: #d63031; font-weight: bold;">${reason}</p>
            </div>

            <p>We apologize for any inconvenience caused. You can try booking other available cars or contact the car owner for more information.</p>

            <p style="color: #666; font-size: 12px;">
                If you have any questions, please contact our support team.
            </p>
        </div>
    `

    return await sendEmail(email, subject, html)
}
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true },
    mobile: {type: String, required: true},
    password: {type: String, required: true },
    role: {type: String, enum: ["owner", "user", "admin"], default: 'user' },
    image: {type: String, default: ''},
    kyc: {
        idProof: {type: String, default: ''},
        drivingLicense: {type: String, default: ''},
        profilePhoto: {type: String, default: ''},
        addressProof: {type: String, default: ''}
    },
    isKycSubmitted: {type: Boolean, default: false},
    isKycApproved: {type: Boolean, default: false},
    isKycRejected: {type: Boolean, default: false},
    kycRejectionReason: {type: String, default: ''},
    resetPasswordToken: { type: String, default: '' },
    resetPasswordExpires: { type: Date },
    totalRevenue: { type: Number, default: 0 },
    totalRefunded: { type: Number, default: 0 }
},{timestamps: true})

const User = mongoose.model('User', userSchema)

export default User
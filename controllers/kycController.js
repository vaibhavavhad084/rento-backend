import imagekit from "../configs/imageKit.js";
import User from "../models/User.js";
import { sendKYCApprovalEmail, sendKYCRejectionEmail } from "./notificationController.js";

// API to Submit KYC
export const submitKYC = async (req, res) => {
    try {
        const { _id } = req.user;
        const files = req.files || {};

        const idProofFile = files.idProof?.[0];
        const drivingLicenseFile = files.drivingLicense?.[0];
        const profilePhotoFile = files.profilePhoto?.[0];
        const addressProofFile = files.addressProof?.[0];

        if (!idProofFile || !drivingLicenseFile || !profilePhotoFile) {
            return res.json({
                success: false,
                message: "ID Proof, Driving License, and Profile Photo are required"
            });
        }

        const uploadFile = async (file, folder) => {
            const response = await imagekit.upload({
                file: file.buffer,
                fileName: file.originalname,
                folder
            });
            return imagekit.url({
                path: response.filePath,
                transformation: [
                    { width: '1280' },
                    { quality: 'auto' },
                    { format: 'webp' }
                ]
            });
        };

        const kyc = {
            idProof: await uploadFile(idProofFile, '/kyc'),
            drivingLicense: await uploadFile(drivingLicenseFile, '/kyc'),
            profilePhoto: await uploadFile(profilePhotoFile, '/kyc'),
            addressProof: addressProofFile ? await uploadFile(addressProofFile, '/kyc') : ''
        };

        await User.findByIdAndUpdate(_id, {
            kyc,
            isKycSubmitted: true,
            isKycApproved: false,
            isKycRejected: false,
            kycRejectionReason: ''
        });

        res.json({
            success: true,
            message: "KYC submitted successfully. Waiting for admin approval."
        });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to Get All Pending KYC Requests (Admin)
export const getPendingKYCRequests = async (req, res) => {
    try {
        const users = await User.find({
            isKycSubmitted: true,
            isKycApproved: false
        }).select("-password");

        res.json({
            success: true,
            users
        });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to Approve KYC (Admin)
export const approveKYC = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        await User.findByIdAndUpdate(id, {
            isKycApproved: true,
            isKycRejected: false,
            kycRejectionReason: '',
            role: "owner"
        });

        // Send KYC approval email
        try {
            if (user.email) {
                const emailResult = await sendKYCApprovalEmail(user.email);
                console.log('KYC approval email result:', emailResult);
            }
        } catch (emailError) {
            console.error('Error sending KYC approval email:', emailError.message);
            // Don't fail the KYC approval if email fails
        }

        res.json({
            success: true,
            message: "KYC approved successfully"
        });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to Reject KYC (Admin)
export const rejectKYC = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        if (!reason || reason.trim() === '') {
            return res.json({ success: false, message: "Rejection reason is required" });
        }

        await User.findByIdAndUpdate(id, {
            kyc: {
                idProof: '',
                drivingLicense: '',
                profilePhoto: '',
                addressProof: ''
            },
            isKycSubmitted: false,
            isKycApproved: false,
            isKycRejected: true,
            kycRejectionReason: reason
        });

        // Send KYC rejection email
        try {
            if (user.email) {
                const emailResult = await sendKYCRejectionEmail(user.email, reason);
                console.log('KYC rejection email result:', emailResult);
            }
        } catch (emailError) {
            console.error('Error sending KYC rejection email:', emailError.message);
            // Don't fail the KYC rejection if email fails
        }

        res.json({
            success: true,
            message: "KYC rejected successfully"
        });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// API to Get KYC Status for User
export const getKYCStatus = async (req, res) => {
    try {
        const { _id } = req.user;
        const user = await User.findById(_id).select('isKycSubmitted isKycApproved isKycRejected kycRejectionReason kyc');

        res.json({
            success: true,
            isKycSubmitted: user.isKycSubmitted,
            isKycApproved: user.isKycApproved,
            isKycRejected: user.isKycRejected,
            kycRejectionReason: user.kycRejectionReason,
            kyc: user.kyc
        });

    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

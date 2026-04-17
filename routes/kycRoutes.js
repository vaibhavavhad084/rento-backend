import express from "express";
import { protect, admin } from "../middleware/auth.js";
import {
    submitKYC,
    getPendingKYCRequests,
    approveKYC,
    rejectKYC,
    getKYCStatus
} from "../controllers/kycController.js";
import upload from "../middleware/multer.js";

const kycRouter = express.Router();

// User routes
kycRouter.post("/submit", protect, upload.fields([
    { name: 'idProof', maxCount: 1 },
    { name: 'drivingLicense', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 }
]), submitKYC);

kycRouter.get("/status", protect, getKYCStatus);

// Admin routes
kycRouter.get("/requests", protect, admin, getPendingKYCRequests);
kycRouter.patch("/approve/:id", protect, admin, approveKYC);
kycRouter.patch("/reject/:id", protect, admin, rejectKYC);

export default kycRouter;

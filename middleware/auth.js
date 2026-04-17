import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next)=>{
    let token = req.headers.authorization;
    if (!token) {
        return res.json({success: false, message: "not authorized"})
    }
    if (token.startsWith('Bearer ')) {
        token = token.split(' ')[1]
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        if (!decoded?.id) {
            return res.json({success: false, message: "not authorized"})
        }
        req.user = await User.findById(decoded.id).select("-password")
        if (!req.user) {
            return res.json({success: false, message: "not authorized"})
        }
        next();
    } catch (error) {
        return res.json({success: false, message: "not authorized"})
    }
}

export const admin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.json({ success: false, message: 'Admin access required' })
    }
    next()
}
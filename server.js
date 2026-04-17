import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./configs/db.js";
import userRouter from "./routes/userRoutes.js";
import ownerRouter from "./routes/ownerRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import authRouter from "./routes/authRoutes.js";
import kycRouter from "./routes/kycRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import bcrypt from "bcrypt";
import User from "./models/User.js";

// Initialize Express App
const app = express()

// Connect Database
await connectDB()

// Create Admin User if not exists
const createAdminUser = async () => {
    try {
        const adminExists = await User.findOne({ email: "admin@example.com" });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash("Pass@123", 10);
            await User.create({
                name: "Admin",
                email: "admin@example.com",
                mobile: "1234567890",
                password: hashedPassword,
                role: "admin"
            });
            console.log("Admin user created: admin@example.com / Pass@123");
        } else {
            console.log("Admin user already exists");
        }
    } catch (error) {
        console.error("Error creating admin user:", error);
    }
};

await createAdminUser();

// Middleware
const allowedOrigins = [
  'http://localhost:5173', // Development
  'http://localhost:3000', // Development server
  'https://client-cev35jm6q-vaibhavavhad264-6125s-projects.vercel.app', // Current Vercel URL
  'https://client-rnleqgvmg-vaibhavavhad264-6125s-projects.vercel.app', // Latest Vercel URL
  process.env.FRONTEND_URL, // Production Vercel URL
].filter(Boolean)

app.use(cors({
  origin: function (origin, callback) {
    console.log('Request from origin:', origin);
    console.log('Allowed origins:', allowedOrigins);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    } else {
      console.log('CORS blocked for origin:', origin);
      return callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));
app.use(express.json());

app.get('/', (req, res)=> res.send("Server is running"))
app.use('/api/user', userRouter)
app.use('/api/auth', authRouter)
app.use('/api/owner', ownerRouter)
app.use('/api/kyc', kycRouter)
app.use('/api/bookings', bookingRouter)
app.use('/api/admin', adminRouter)
app.use('/api/payment', paymentRouter)

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server running on port ${PORT}`))
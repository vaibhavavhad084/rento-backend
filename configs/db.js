import mongoose from "mongoose";

const connectDB = async ()=>{
    try {
        // Check if already connected
        if (mongoose.connection.readyState >= 1) {
            console.log("Database already connected");
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
            bufferMaxEntries: 0,
            maxPoolSize: 10,
        });

        console.log("Database Connected Successfully");
    } catch (error) {
        console.error("Database connection error:", error.message);
        throw error;
    }
}

export default connectDB;
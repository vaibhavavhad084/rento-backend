import mongoose from "mongoose";

const connectDB = async ()=>{
    try {
        // Check if already connected
        if (mongoose.connections[0].readyState) {
            console.log("Database already connected");
            return;
        }

        const conn = await mongoose.connect(`${process.env.MONGODB_URI}/car-rental`, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
            bufferCommands: false, // Disable mongoose buffering
            bufferMaxEntries: 0, // Disable mongoose buffering
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        });

        console.log("Database Connected Successfully");
    } catch (error) {
        console.error("Database connection error:", error.message);
        throw error;
    }
}

export default connectDB;
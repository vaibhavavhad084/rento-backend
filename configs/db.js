import mongoose from "mongoose";

const connectDB = async ()=>{
    try {
        // Check if already connected
        if (mongoose.connection.readyState >= 1) {
            console.log("Database already connected");
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000, // Increased timeout
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2, // Keep minimum connections
            maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
            bufferCommands: false, // Disable mongoose buffering
            bufferMaxEntries: 0, // Disable mongoose buffering
        });

        console.log("Database Connected Successfully");

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('Database connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('Database disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('Database reconnected');
        });

    } catch (error) {
        console.error("Database connection error:", error.message);
        throw error;
    }
}
    }
}

export default connectDB;
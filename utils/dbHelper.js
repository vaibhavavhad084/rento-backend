import mongoose from 'mongoose';

// Helper function to check database connection
export const checkDBConnection = () => {
    if (mongoose.connection.readyState !== 1) {
        throw new Error('Database connection lost or not established');
    }
};

// Helper function for findOne operations with timeout
export const findOneWithTimeout = async (Model, query) => {
    checkDBConnection();
    try {
        const result = await Model.findOne(query).maxTimeMS(10000);
        return result;
    } catch (error) {
        if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
            console.error('Database query timed out:', error.message);
            throw new Error('Database operation timed out. Please try again.');
        }
        throw error;
    }
};

// Helper function for find operations with timeout
export const findWithTimeout = async (Model, query = {}) => {
    checkDBConnection();
    try {
        const result = await Model.find(query).maxTimeMS(10000);
        return result;
    } catch (error) {
        if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
            console.error('Database query timed out:', error.message);
            throw new Error('Database operation timed out. Please try again.');
        }
        throw error;
    }
};

// Helper function for create operations with timeout
export const createWithTimeout = async (Model, data) => {
    checkDBConnection();
    try {
        const result = await Model.create(data);
        return result;
    } catch (error) {
        if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
            console.error('Database query timed out:', error.message);
            throw new Error('Database operation timed out. Please try again.');
        }
        throw error;
    }
};

// Helper function for updateOne operations with timeout
export const updateOneWithTimeout = async (Model, filter, update, options = {}) => {
    checkDBConnection();
    try {
        const result = await Model.updateOne(filter, update, { maxTimeMS: 10000, ...options });
        return result;
    } catch (error) {
        if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
            console.error('Database query timed out:', error.message);
            throw new Error('Database operation timed out. Please try again.');
        }
        throw error;
    }
};

// Helper function for findByIdAndUpdate operations with timeout
export const findByIdAndUpdateWithTimeout = async (Model, id, update, options = {}) => {
    checkDBConnection();
    try {
        const result = await Model.findByIdAndUpdate(id, update, { maxTimeMS: 10000, new: true, ...options });
        return result;
    } catch (error) {
        if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
            console.error('Database query timed out:', error.message);
            throw new Error('Database operation timed out. Please try again.');
        }
        throw error;
    }
};

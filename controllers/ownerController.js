import imagekit from "../configs/imageKit.js";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import User from "../models/User.js";


// API to Change Role of User
export const changeRoleToOwner = async (req, res)=>{
    try {
        const {_id} = req.user;
        const user = await User.findById(_id);
        
        // Check if user has KYC approved
        if (!user.isKycApproved) {
            return res.json({success: false, message: "Please complete KYC verification first", needsKYC: true})
        }
        
        await User.findByIdAndUpdate(_id, {role: "owner"})
        res.json({success: true, message: "Now you can list cars"})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to List Car

export const addCar = async (req, res)=>{
    try {
        const {_id} = req.user;
        
        // Check KYC approval
        const user = await User.findById(_id);
        if (!user.isKycApproved) {
            return res.json({ success: false, message: "KYC verification required to list cars" });
        }
        
        let car = JSON.parse(req.body.carData);
        const files = req.files || {};
        const imageFile = files.image?.[0];
        const rcFile = files.rc?.[0];
        const insuranceFile = files.insurance?.[0];
        const pucFile = files.puc?.[0];
        const additionalImages = files.images || [];

        if (!imageFile) {
            return res.json({ success: false, message: "Main car image is required" });
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

        const image = await uploadFile(imageFile, '/cars');
        const carImages = await Promise.all(additionalImages.map((file) => uploadFile(file, '/cars')));

        const documents = {};
        if (rcFile) documents.rc = await uploadFile(rcFile, '/documents');
        if (insuranceFile) documents.insurance = await uploadFile(insuranceFile, '/documents');
        if (pucFile) documents.puc = await uploadFile(pucFile, '/documents');

        await Car.create({
            ...car,
            owner: _id,
            image,
            images: carImages,
            documents,
            isApproved: false
        });

        res.json({success: true, message: "Car Added"})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to List Owner Cars
export const getOwnerCars = async (req, res)=>{
    try {
        const {_id} = req.user;
        const cars = await Car.find({owner: _id })
        res.json({success: true, cars})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to Toggle Car Availability
export const toggleCarAvailability = async (req, res) =>{
    try {
        const {_id} = req.user;
        const {carId} = req.body
        const car = await Car.findById(carId)

        // Checking is car belongs to the user
        if(car.owner.toString() !== _id.toString()){
            return res.json({ success: false, message: "Unauthorized" });
        }

        car.isAvaliable = !car.isAvaliable;
        await car.save()

        res.json({success: true, message: "Availability Toggled"})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// Api to delete a car
export const deleteCar = async (req, res) =>{
    try {
        const {_id} = req.user;
        const {carId} = req.body
        const car = await Car.findById(carId)

        // Checking is car belongs to the user
        if(car.owner.toString() !== _id.toString()){
            return res.json({ success: false, message: "Unauthorized" });
        }

        car.owner = null;
        car.isAvaliable = false;

        await car.save()

        res.json({success: true, message: "Car Removed"})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to get Dashboard Data
export const getDashboardData = async (req, res) =>{
    try {
        const { _id, role } = req.user;

        if(role !== 'owner'){
            return res.json({ success: false, message: "Unauthorized" });
        }

        const cars = await Car.find({owner: _id})
        const bookings = await Booking.find({ owner: _id }).populate('car').sort({ createdAt: -1 });

        const pendingBookings = await Booking.find({owner: _id, status: "pending" })
        const completedBookings = await Booking.find({owner: _id, status: "confirmed" })

        const now = new Date();
        const monthlyRevenue = bookings.slice().filter(booking => {
            const createdAt = new Date(booking.createdAt);
            return booking.paymentStatus === 'paid' &&
                createdAt.getFullYear() === now.getFullYear() &&
                createdAt.getMonth() === now.getMonth();
        }).reduce((acc, booking)=> acc + booking.price, 0)

        const dashboardData = {
            totalCars: cars.length,
            totalBookings: bookings.length,
            pendingBookings: pendingBookings.length,
            completedBookings: completedBookings.length,
            recentBookings: bookings.slice(0,3),
            monthlyRevenue
        }

        res.json({ success: true, dashboardData });

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// API to update user image

export const updateUserImage = async (req, res)=>{
    try {
        const { _id } = req.user;

        const imageFile = req.file;

        const response = await imagekit.upload({
            file: imageFile.buffer,
            fileName: imageFile.originalname,
            folder: '/users'
        })

        const optimizedImageUrl = imagekit.url({
            path : response.filePath,
            transformation : [
                {width: '400'},
                {quality: 'auto'},
                { format: 'webp' }
            ]
        });

        const image = optimizedImageUrl;

        await User.findByIdAndUpdate(_id, {image});
        res.json({success: true, message: "Image Updated" })

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}   
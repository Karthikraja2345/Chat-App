const User = require('../models/User');
const jwt = require('jsonwebtoken');
// const twilio = require('twilio'); // For actual SMS

// Mock OTP generation
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); // For real SMS

// @desc    Send OTP to phone number
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOTP = async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required' });
    }

    try {
        let user = await User.findOne({ phoneNumber });
        const otp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000; // OTP expires in 10 minutes

        if (!user) {
            user = await User.create({ phoneNumber, otp, otpExpires });
        } else {
            user.otp = otp;
            user.otpExpires = otpExpires;
            user.isVerified = false; // Reset verification status if re-requesting OTP
            await user.save();
        }

        // --- Mock SMS sending ---
        console.log(`OTP for ${phoneNumber}: ${otp}`);
        // --- For actual SMS (e.g., Twilio) ---
        // await client.messages.create({
        //     body: `Your Messaging App OTP is: ${otp}`,
        //     from: process.env.TWILIO_PHONE_NUMBER,
        //     to: phoneNumber // ensure it's E.164 format
        // });

        res.status(200).json({ message: 'OTP sent successfully. (Check console for mock OTP)' });
    } catch (error) {
        console.error(error);
        // if (error.code === 21211 && error.message.includes("not a valid phone number")) {
        //     return res.status(400).json({ message: 'Invalid phone number format for Twilio.'})
        // }
        res.status(500).json({ message: 'Server error while sending OTP' });
    }
};

// @desc    Verify OTP and login/register user
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
        return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    try {
        const user = await User.findOne({ phoneNumber });

        if (!user) {
            return res.status(404).json({ message: 'User not found. Please request OTP first.' });
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        user.isVerified = true;
        user.otp = undefined; // Clear OTP
        user.otpExpires = undefined; // Clear OTP expiry
        await user.save();

        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: {
                id: user.id,
                phoneNumber: user.phoneNumber,
                name: user.name,
                profilePicture: user.profilePicture,
                isVerified: user.isVerified,
                needsProfileSetup: !user.name // Check if profile needs setup
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
    name: { type: String },
    profilePicture: { type: String, default: 'client/src/assets/male.png' }, // URL to image
    status: { type: String, default: 'Hey there! I am using this app.' },
    createdAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    online: { type: Boolean, default: false }
});

// Method to compare password (if you add password auth later)
// UserSchema.methods.matchPassword = async function(enteredPassword) {
//  return await bcrypt.compare(enteredPassword, this.password);
// };

// Hash OTP before saving (or just store plain for mock)
// UserSchema.pre('save', async function(next) {
//  if (!this.isModified('otp') || !this.otp) {
//      next();
//  }
//  const salt = await bcrypt.genSalt(10);
//  this.otp = await bcrypt.hash(this.otp, salt); // Only if you want to hash OTP
// });


module.exports = mongoose.model('User', UserSchema);
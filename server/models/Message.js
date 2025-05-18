const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true }, // or groupId
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: {
        text: { type: String },
        image: { type: String }, // URL to image
        pdf: { type: String },   // URL to PDF
    },
    type: { type: String, enum: ['text', 'image', 'pdf', 'payment_split', 'task_notification'], required: true },
    // For payment split
    paymentDetails: {
        amount: Number,
        description: String,
        upiLink: String, // e.g., upi://pay?pa=user@bank&pn=UserName&am=100&cu=INR&tn=PaymentDescription
    },
    // For read receipts
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Who has read it (for groups)
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
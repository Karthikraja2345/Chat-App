// server/models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: {
        type: mongoose.Schema.Types.Mixed, // Allows any structure within content (e.g., {text: "hi"}, or {fileUrl:"...", fileName:"..."})
        required: true
    },
    type: {
        type: String,
        enum: [
            'text',
            'image',
            'pdf',
            'video',        // ADDED
            'audio',        // ADDED
            'document',     // ADDED
            'file',         // ADDED (generic fallback for other types)
            'payment_split',
            'task_notification'
            // Add any other specific types you determine on the frontend
        ],
        required: true
    },
    paymentDetails: { // This can remain if used for 'payment_split' type specifically
        amount: Number,
        description: String,
        upiLink: String,
    },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    timestamp: { type: Date, default: Date.now }
});

// Optional: Create an index for faster querying of messages by chatId and timestamp
MessageSchema.index({ chatId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', MessageSchema);
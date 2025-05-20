// server/models/Chat.js
const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    name: { type: String }, // Group name
    isGroupChat: { type: Boolean, default: false },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Only for group chats
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // NEW: Who created the group
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    // For group calendar/tasks
    tasks: [{
        title: String,
        description: String,
        dueDate: Date,
        assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        completed: { type: Boolean, default: false },
    }],
    // timestamps: true // Mongoose will add createdAt and updatedAt automatically if { timestamps: true } is 2nd arg to Schema
}, { timestamps: true }); // This will add createdAt and updatedAt automatically

module.exports = mongoose.model('Chat', ChatSchema);
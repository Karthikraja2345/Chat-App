const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    name: { type: String }, // Group name
    isGroupChat: { type: Boolean, default: false },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Only for group chats
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', ChatSchema);
// server/socket/socketHandler.js
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
// const { translateText } = require('../services/translationService'); // Placeholder

let onlineUsers = new Map(); // Map userID to array of socketIDs (user might have multiple tabs/devices)

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('Socket Backend: A user connected. Socket ID:', socket.id);

        socket.on('userOnline', async (userId) => {
            if (userId) {
                // Add socket.id to the list of sockets for this userId
                if (!onlineUsers.has(userId.toString())) {
                    onlineUsers.set(userId.toString(), []);
                }
                onlineUsers.get(userId.toString()).push(socket.id);

                console.log(`Socket Backend: User ${userId} came online with socket ${socket.id}. Total sockets for user: ${onlineUsers.get(userId.toString()).length}`);
                try {
                    await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
                    // Consider emitting online status to specific contacts rather than globally
                    // io.emit('userStatusUpdate', { userId, online: true, lastSeen: new Date() });
                } catch (err) {
                    console.error("Socket Backend: Error updating user online status:", err);
                }
            } else {
                console.warn('Socket Backend: "userOnline" event received without userId.');
            }
        });

        socket.on('joinChat', (chatId) => {
            if (chatId) {
                socket.join(chatId);
                console.log(`Socket Backend: Socket ${socket.id} joined chat room: ${chatId}`);
            } else {
                console.warn(`Socket Backend: Socket ${socket.id} tried to join null/undefined chat room.`);
            }
        });

        socket.on('leaveChat', (chatId) => {
            if (chatId) {
                socket.leave(chatId);
                console.log(`Socket Backend: Socket ${socket.id} left chat room: ${chatId}`);
            }
        });

        socket.on('sendMessage', async (data) => {
            console.log('Socket Backend: "sendMessage" event received. Raw Data:', JSON.stringify(data, null, 2));

            // Destructure with defaults or checks
            const chatId = data?.chatId;
            const senderId = data?.senderId;
            const content = data?.content;
            const type = data?.type;
            const paymentDetails = data?.paymentDetails; // Optional

            if (!chatId || !senderId || !content || !type) {
                console.error('Socket Backend sendMessage: Missing required data. Received:',
                    { chatId, senderId, contentExists: !!content, type }
                );
                socket.emit('messageError', { message: 'Server Error: Missing required data for sending message.' });
                return;
            }
            console.log(`Socket Backend sendMessage: Processing message. ChatID: ${chatId}, SenderID: ${senderId}, Type: ${type}`);

            try {
                const messageData = {
                    chatId: chatId, // Ensure this is a valid ObjectId string
                    sender: senderId, // Ensure this is a valid ObjectId string
                    content: content, // content should be { text, image, pdf }
                    type: type,
                    status: 'sent'
                };

                if (type === 'payment_split' && paymentDetails) {
                    messageData.paymentDetails = paymentDetails;
                }

                let newMessage = new Message(messageData);
                await newMessage.save();
                console.log('Socket Backend sendMessage: Message saved to DB with ID:', newMessage._id);

                // Populate sender details for the message being emitted
                newMessage = await newMessage.populate('sender', 'name profilePicture phoneNumber');
                // newMessage = await Message.findById(newMessage._id).populate('sender', 'name profilePicture phoneNumber'); // Alternative way to populate

                // Update lastMessage in the Chat document
                const updatedChat = await Chat.findByIdAndUpdate(
                    chatId,
                    { lastMessage: newMessage._id, updatedAt: Date.now() },
                    { new: true } // Return the updated document
                ).populate('participants', '_id online'); // Populate participants to check their online status if needed later

                if (!updatedChat) {
                    console.error(`Socket Backend sendMessage: Could not find or update chat with ID ${chatId} after saving message.`);
                    // Decide how to handle this - message is saved, but chat not updated
                } else {
                     console.log(`Socket Backend sendMessage: Chat ${chatId} lastMessage updated to ${newMessage._id}.`);
                }

                console.log('Socket Backend sendMessage: Emitting "receiveMessage" to room:', chatId, 'Payload:', JSON.stringify(newMessage, null, 2));
                io.to(chatId).emit('receiveMessage', newMessage); // Emit to all sockets in the chat room

            } catch (error) {
                // This catch block will catch errors like "Cast to ObjectId failed" if chatId or senderId is invalid
                console.error('Socket Backend sendMessage: Error saving message or updating chat:', error);
                console.error('Socket Backend sendMessage: Error name:', error.name, 'Error message:', error.message);
                if (error.name === 'CastError') {
                    console.error('Socket Backend sendMessage: CastError details - Path:', error.path, 'Value:', error.value);
                }
                socket.emit('messageError', { message: 'Server error: Could not send message. ' + error.message });
            }
        });

        socket.on('messageRead', async (data) => {
            const { messageId, chatId, userId } = data;
            console.log(`Socket Backend: "messageRead" event. MsgID: ${messageId}, ChatID: ${chatId}, UserID: ${userId}`);
            if (!messageId || !chatId || !userId) {
                console.warn('Socket Backend messageRead: Missing data for messageRead event.');
                return;
            }
            try {
                const message = await Message.findById(messageId);
                if (message) {
                    let statusChanged = false;
                    if (!message.readBy.map(id => id.toString()).includes(userId.toString())) {
                        message.readBy.push(userId);
                        statusChanged = true;
                    }

                    // Simplified logic for 1-on-1 read status
                    // For a message to be "read" overall, the other participant must have read it
                    if (message.sender.toString() !== userId.toString()) { // If reader is not sender
                        const chat = await Chat.findById(chatId);
                        if (chat && !chat.isGroupChat) {
                             // In 1-on-1, if a recipient reads it, mark as 'read'
                            if (message.status !== 'read') {
                                message.status = 'read';
                                statusChanged = true;
                            }
                        }
                        // Group chat "read" status is more complex (e.g., all other participants read)
                        // For now, just updating readBy is fine for groups.
                    }

                    if (statusChanged) {
                        await message.save();
                        console.log(`Socket Backend messageRead: Message ${messageId} updated. Status: ${message.status}, ReadBy count: ${message.readBy.length}`);
                    }

                    io.to(chatId).emit('messageStatusUpdate', {
                        messageId: message._id,
                        status: message.status,
                        readBy: message.readBy
                    });
                } else {
                    console.warn(`Socket Backend messageRead: Message ${messageId} not found.`);
                }
            } catch (error) {
                console.error('Socket Backend messageRead: Error updating message status:', error);
            }
        });

        socket.on('typing', ({ chatId, userName }) => {
            if (chatId && userName) {
                // Emit to others in the room, not back to the sender
                socket.to(chatId).emit('userTyping', { chatId, userName });
                console.log(`Socket Backend: User ${userName} is typing in chat ${chatId}. Socket: ${socket.id}`);
            }
        });

        socket.on('stopTyping', ({ chatId }) => {
            if (chatId) {
                socket.to(chatId).emit('userStopTyping', { chatId });
                console.log(`Socket Backend: User stopped typing in chat ${chatId}. Socket: ${socket.id}`);
            }
        });


        socket.on('disconnect', async () => {
            console.log('Socket Backend: User disconnected. Socket ID:', socket.id);
            let disconnectedUserId;
            for (let [userId, socketIds] of onlineUsers.entries()) {
                const index = socketIds.indexOf(socket.id);
                if (index !== -1) {
                    socketIds.splice(index, 1); // Remove this socket.id
                    if (socketIds.length === 0) { // If no more sockets for this user
                        onlineUsers.delete(userId);
                        disconnectedUserId = userId;
                    }
                    break;
                }
            }

            if (disconnectedUserId) {
                 console.log(`Socket Backend: User ${disconnectedUserId} all sockets disconnected, marking as offline.`);
                try {
                    await User.findByIdAndUpdate(disconnectedUserId, { online: false, lastSeen: new Date() });
                    // Consider emitting to contacts: io.emit('userStatusUpdate', { userId: disconnectedUserId, online: false, lastSeen: new Date() });
                } catch(err) {
                    console.error("Socket Backend: Error updating user offline status:", err);
                }
            }
        });
    });
};
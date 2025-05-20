// server/socket/socketHandler.js
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

let onlineUsers = new Map();

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('Socket Backend: A user connected. Socket ID:', socket.id);

        socket.on('userOnline', async (userId) => {
            if (userId) {
                if (!onlineUsers.has(userId.toString())) {
                    onlineUsers.set(userId.toString(), []);
                }
                if (!onlineUsers.get(userId.toString()).includes(socket.id)) {
                    onlineUsers.get(userId.toString()).push(socket.id);
                }
                console.log(`Socket Backend: User ${userId} online with socket ${socket.id}. Sockets for user: ${onlineUsers.get(userId.toString())?.length}`);
                try {
                    await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
                } catch (err) { console.error("Socket Backend: Error updating user online status:", err); }
            } else { console.warn('Socket Backend: "userOnline" event without userId.'); }
        });

        socket.on('joinChat', (chatId) => {
            if (chatId) {
                socket.join(chatId);
                console.log(`Socket Backend: Socket ${socket.id} joined chat room: ${chatId}`);
            } else { console.warn(`Socket Backend: Socket ${socket.id} tried to join null chat room.`); }
        });

        socket.on('leaveChat', (chatId) => {
            if (chatId) {
                socket.leave(chatId);
                console.log(`Socket Backend: Socket ${socket.id} left chat room: ${chatId}`);
            }
        });

        socket.on('sendMessage', async (data) => {
            console.log('Socket Backend: "sendMessage" event received. Raw Data:', JSON.stringify(data, null, 2));
            const { chatId, senderId, content, type, paymentDetails } = data || {};

            if (!chatId || !senderId || !content || !type) {
                console.error('Socket Backend sendMessage: FAIL - Missing required data.', { chatId, senderId, contentExists: !!content, type });
                socket.emit('messageError', { message: 'Server Error: Missing data for sending message.' });
                return;
            }
            console.log(`Socket Backend sendMessage: PASS - Processing. ChatID: ${chatId}, SenderID: ${senderId}, Type: ${type}`);

            try {
                const messageData = { chatId, sender: senderId, content, type, status: 'sent' };
                if (type === 'payment_split' && paymentDetails) messageData.paymentDetails = paymentDetails;

                console.log('Socket Backend sendMessage: Creating Message with data:', JSON.stringify(messageData, null, 2));
                let newMessage = new Message(messageData);
                await newMessage.save();
                console.log('Socket Backend sendMessage: SUCCESS - Message saved. ID:', newMessage._id);

                newMessage = await newMessage.populate('sender', 'name profilePicture phoneNumber');
                console.log('Socket Backend sendMessage: Message populated with sender.');

                const updatedChat = await Chat.findByIdAndUpdate(chatId,
                    { lastMessage: newMessage._id, updatedAt: Date.now() }, { new: true }
                );
                if (!updatedChat) console.error(`Socket Backend sendMessage: FAIL - Could not update chat ${chatId}.`);
                else console.log(`Socket Backend sendMessage: SUCCESS - Chat ${chatId} lastMessage updated.`);

                console.log('Socket Backend sendMessage: Emitting "receiveMessage" to room:', chatId);
                io.to(chatId).emit('receiveMessage', newMessage.toObject()); // Send plain object
            } catch (error) {
                console.error('Socket Backend sendMessage: FAIL - Error during processing:', error.name, error.message, {data});
                if (error.name === 'CastError') console.error('CastError details - Path:', error.path, 'Value:', error.value);
                socket.emit('messageError', { message: 'Server error: Could not send. ' + error.message });
            }
        });

        socket.on('messageRead', async (data) => {
            const { messageId, chatId, userId } = data || {}; // userId is the reader
            console.log(`Socket Backend: "messageRead" event. MsgID: ${messageId}, ChatID: ${chatId}, Reader UserID: ${userId}`);

            if (!messageId || !chatId || !userId) {
                console.warn('Socket Backend messageRead: Missing data.', {data}); return;
            }
            try {
                const message = await Message.findById(messageId);
                if (!message) { console.warn(`Socket Backend messageRead: Message ${messageId} not found.`); return; }

                console.log(`Socket Backend messageRead: Found msg ${messageId}. ReadBy: [${message.readBy.join(', ')}], Status: ${message.status}`);
                let changed = false;

                if (!message.readBy.map(id => id.toString()).includes(userId.toString())) {
                    message.readBy.push(userId);
                    console.log(`Socket Backend messageRead: Added ${userId} to readBy for ${messageId}.`);
                    changed = true;
                }

                if (message.sender.toString() !== userId.toString()) {
                    const chat = await Chat.findById(chatId);
                    if (chat && !chat.isGroupChat && message.status !== 'read') {
                        message.status = 'read';
                        console.log(`Socket Backend messageRead: Msg ${messageId} status set to 'read' (1-on-1).`);
                        changed = true;
                    }
                }

                if (changed) {
                    await message.save();
                    console.log(`Socket Backend messageRead: Msg ${messageId} saved. New status: ${message.status}, ReadBy: ${message.readBy.length}`);
                } else { console.log(`Socket Backend messageRead: No changes to save for msg ${messageId}.`); }

                io.to(chatId).emit('messageStatusUpdate', {
                    messageId: message._id.toString(),
                    status: message.status,
                    readBy: message.readBy.map(id => id.toString())
                });
            } catch (error) {
                console.error('Socket Backend messageRead: Error updating status:', error, {data});
            }
        });

        socket.on('typing', ({ chatId, userName }) => {
            if (chatId && userName) socket.to(chatId).emit('userTyping', { chatId, userName });
        });
        socket.on('stopTyping', ({ chatId }) => {
            if (chatId) socket.to(chatId).emit('userStopTyping', { chatId });
        });

        socket.on('disconnect', async () => {
            console.log('Socket Backend: User disconnected. Socket ID:', socket.id);
            let disconnectedUserId;
            for (let [userIdStr, socketIds] of onlineUsers.entries()) {
                const index = socketIds.indexOf(socket.id);
                if (index !== -1) {
                    socketIds.splice(index, 1);
                    if (socketIds.length === 0) {
                        onlineUsers.delete(userIdStr);
                        disconnectedUserId = userIdStr;
                    }
                    break;
                }
            }
            if (disconnectedUserId) {
                 console.log(`Socket Backend: User ${disconnectedUserId} fully offline.`);
                try { await User.findByIdAndUpdate(disconnectedUserId, { online: false, lastSeen: new Date() }); }
                catch(err) { console.error("Socket Backend: Error updating user offline status:", err); }
            }
        });
    });
};
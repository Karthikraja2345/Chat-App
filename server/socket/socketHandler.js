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
                const userIdStr = userId.toString();
                if (!onlineUsers.has(userIdStr)) {
                    onlineUsers.set(userIdStr, []);
                }
                if (!onlineUsers.get(userIdStr).includes(socket.id)) {
                    onlineUsers.get(userIdStr).push(socket.id);
                }
                console.log(`Socket Backend: User ${userIdStr} online with socket ${socket.id}. Sockets for user: ${onlineUsers.get(userIdStr)?.length}`);
                try {
                    await User.findByIdAndUpdate(userIdStr, { online: true, lastSeen: new Date() });
                } catch (err) { console.error("Socket Backend: Error updating user online status:", err); }
            } else { console.warn('Socket Backend: "userOnline" event without userId.'); }
        });

        socket.on('joinChat', (chatId) => {
            if (chatId) {
                socket.join(chatId.toString()); // Ensure chatId is a string for room name
                console.log(`Socket Backend: Socket ${socket.id} joined chat room: ${chatId.toString()}`);
            } else { console.warn(`Socket Backend: Socket ${socket.id} tried to join null chat room.`); }
        });

        socket.on('leaveChat', (chatId) => {
            if (chatId) {
                socket.leave(chatId.toString()); // Ensure chatId is a string
                console.log(`Socket Backend: Socket ${socket.id} left chat room: ${chatId.toString()}`);
            }
        });

        socket.on('sendMessage', async (data) => {
            // console.log('Socket Backend: "sendMessage" event received. Raw Data:', JSON.stringify(data, null, 2));
            const { chatId, senderId, content, type, paymentDetails } = data || {};

            if (!chatId || !senderId || !content || !type) {
                console.error('Socket Backend sendMessage: FAIL - Missing required data.', { chatId, senderId, contentExists: !!content, type });
                socket.emit('messageError', { message: 'Server Error: Missing data for sending message.' });
                return;
            }
            // console.log(`Socket Backend sendMessage: PASS - Processing. ChatID: ${chatId}, SenderID: ${senderId}, Type: ${type}`);

            try {
                const messageToSave = {
                    chatId,
                    sender: senderId,
                    content, // This directly takes the content object from the client
                    type,
                    status: 'sent',
                    readBy: [senderId] // Sender is considered to have read their own message
                };

                if (type === 'payment_split' && paymentDetails) {
                    messageToSave.paymentDetails = paymentDetails;
                }

                // console.log('Socket Backend sendMessage: Creating Message with data:', JSON.stringify(messageToSave, null, 2));
                const newMessageInstance = new Message(messageToSave);
                const savedMessage = await newMessageInstance.save();
                // console.log('Socket Backend sendMessage: SUCCESS - Message saved. ID:', savedMessage._id);

                const populatedMessage = await Message.findById(savedMessage._id)
                    .populate('sender', 'name profilePicture _id') // Select necessary sender fields
                    .exec();

                if (!populatedMessage) {
                    console.error(`Socket Backend sendMessage: FAIL - Could not find/populate message ${savedMessage._id} after saving.`);
                    socket.emit('messageError', { message: 'Server error: Could not process message after saving.' });
                    return;
                }
                // console.log('Socket Backend sendMessage: Message populated with sender.');

                const updatedChat = await Chat.findByIdAndUpdate(
                    chatId,
                    { lastMessage: populatedMessage._id, updatedAt: Date.now() },
                    { new: true }
                ).populate('lastMessage'); // Optionally populate lastMessage for chatUpdated event

                if (!updatedChat) {
                    console.error(`Socket Backend sendMessage: FAIL - Could not update chat ${chatId}.`);
                } else {
                    // console.log(`Socket Backend sendMessage: SUCCESS - Chat ${chatId} lastMessage updated.`);
                    io.to(chatId.toString()).emit('chatListUpdate', { chatId: updatedChat._id, lastMessage: populatedMessage.toObject(), updatedAt: updatedChat.updatedAt });
                }

                // console.log('Socket Backend sendMessage: Emitting "receiveMessage" to room:', chatId.toString());
                io.to(chatId.toString()).emit('receiveMessage', populatedMessage.toObject()); // Send plain object

            } catch (error) {
                console.error('Socket Backend sendMessage: FAIL - Error during processing:', error.name, error.message, {data});
                if (error.name === 'ValidationError') {
                     console.error('ValidationError details:', JSON.stringify(error.errors, null, 2));
                } else if (error.name === 'CastError') {
                    console.error('CastError details - Path:', error.path, 'Value:', error.value);
                }
                socket.emit('messageError', { message: 'Server error: Could not send. ' + error.message });
            }
        });

        socket.on('messageRead', async (data) => {
            const { messageId, chatId, userId } = data || {}; // userId is the reader
            // console.log(`Socket Backend: "messageRead" event. MsgID: ${messageId}, ChatID: ${chatId}, Reader UserID: ${userId}`);

            if (!messageId || !chatId || !userId) {
                console.warn('Socket Backend messageRead: Missing data.', {data}); return;
            }
            try {
                const message = await Message.findById(messageId);
                if (!message) { console.warn(`Socket Backend messageRead: Message ${messageId} not found.`); return; }

                // console.log(`Socket Backend messageRead: Found msg ${messageId}. ReadBy: [${message.readBy.map(id=>id.toString()).join(', ')}], Status: ${message.status}`);
                let changed = false;
                const userIdStr = userId.toString();

                if (!message.readBy.map(id => id.toString()).includes(userIdStr)) {
                    message.readBy.push(userIdStr);
                    // console.log(`Socket Backend messageRead: Added ${userIdStr} to readBy for ${messageId}.`);
                    changed = true;
                }

                if (message.sender.toString() !== userIdStr) {
                    const chat = await Chat.findById(chatId);
                    if (chat && !chat.isGroupChat && message.status !== 'read') {
                        message.status = 'read';
                        // console.log(`Socket Backend messageRead: Msg ${messageId} status set to 'read' (1-on-1).`);
                        changed = true;
                    }
                }

                if (changed) {
                    await message.save();
                    // console.log(`Socket Backend messageRead: Msg ${messageId} saved. New status: ${message.status}, ReadBy: ${message.readBy.length}`);
                } //else { console.log(`Socket Backend messageRead: No changes to save for msg ${messageId}.`); }

                io.to(chatId.toString()).emit('messageStatusUpdate', {
                    messageId: message._id.toString(),
                    status: message.status,
                    readBy: message.readBy.map(id => id.toString())
                });
            } catch (error) {
                console.error('Socket Backend messageRead: Error updating status:', error, {data});
            }
        });

        socket.on('typing', ({ chatId, userName }) => {
            if (chatId && userName) socket.to(chatId.toString()).emit('userTyping', { chatId: chatId.toString(), userName });
        });
        socket.on('stopTyping', ({ chatId }) => {
            if (chatId) socket.to(chatId.toString()).emit('userStopTyping', { chatId: chatId.toString() });
        });

        socket.on('disconnect', async () => {
            // console.log('Socket Backend: User disconnected. Socket ID:', socket.id);
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
                //  console.log(`Socket Backend: User ${disconnectedUserId} fully offline.`);
                try { await User.findByIdAndUpdate(disconnectedUserId, { online: false, lastSeen: new Date() }); }
                catch(err) { console.error("Socket Backend: Error updating user offline status:", err); }
            }
        });
    });
};
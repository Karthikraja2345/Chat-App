// server/controllers/chatController.js
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');

// @desc    Access or create a 1-on-1 chat
// @route   POST /api/chats
// @access  Private
exports.accessChat = async (req, res) => {
    const { userId: targetUserId } = req.body; // The ID of the user you want to chat with
    const currentUserId = req.user._id; // From authMiddleware

    console.log(`Backend accessChat: User ${currentUserId} attempting to access/create chat with ${targetUserId}`);

    if (!targetUserId) {
        console.log("Backend accessChat: targetUserId parameter not sent with request.");
        return res.status(400).json({ message: "UserId param not sent with request" });
    }

    if (currentUserId.toString() === targetUserId.toString()) {
        console.log("Backend accessChat: User cannot create a chat with themselves.");
        return res.status(400).json({ message: "Cannot create a chat with yourself." });
    }

    try {
        let existingChats = await Chat.find({
            isGroupChat: false,
            // Both users must be in the participants array
            $and: [
                { participants: { $elemMatch: { $eq: currentUserId } } },
                { participants: { $elemMatch: { $eq: targetUserId } } },
            ],
            // Ensure participants array has exactly two members for a 1-on-1 chat
            // This helps differentiate from a group chat that might accidentally contain only these two.
            // participants: { $size: 2 } // Can be added if needed, but $and usually sufficient for isGroupChat: false
        })
        .populate("participants", "-password -otp -otpExpires") // Populate participants, exclude sensitive info
        .populate({ // Populate lastMessage and its sender details
            path: "lastMessage",
            populate: {
                path: "sender",
                select: "name profilePicture phoneNumber" // Select fields for the sender of the last message
            }
        });

        if (existingChats.length > 0) {
            // If multiple such chats exist (shouldn't happen for 1-on-1 if logic is correct), take the first one.
            const chatToSend = existingChats[0];
            console.log("Backend accessChat: Existing 1-on-1 chat found. Chat ID:", chatToSend._id);
            console.log("Backend accessChat: Sending existing chat object:", JSON.stringify(chatToSend, null, 2));
            res.status(200).json(chatToSend);
        } else {
            console.log("Backend accessChat: No existing 1-on-1 chat found with these participants. Creating a new chat.");
            const chatData = {
                // chatName: "sender", // Not usually set for 1-on-1 chats
                isGroupChat: false,
                participants: [currentUserId, targetUserId],
                // lastMessage will be updated when a message is sent
            };

            const createdChat = await Chat.create(chatData);
            console.log("Backend accessChat: New chat document created with ID:", createdChat._id);

            // Fetch the newly created chat and populate its participants
            const fullNewChat = await Chat.findById(createdChat._id)
                .populate("participants", "-password -otp -otpExpires"); // Populate participants of the new chat

            if (!fullNewChat) {
                console.error("Backend accessChat: Failed to fetch newly created chat for population. Chat ID:", createdChat._id);
                return res.status(500).json({ message: "Error creating chat, could not retrieve chat details." });
            }

            console.log("Backend accessChat: Full new chat details to be sent. Chat ID:", fullNewChat._id);
            console.log("Backend accessChat: Sending new chat object:", JSON.stringify(fullNewChat, null, 2));
            res.status(200).json(fullNewChat);
        }
    } catch (error) {
        console.error("Backend accessChat: Server error:", error);
        res.status(500).json({ message: "Server error accessing or creating chat: " + error.message });
    }
};

// @desc    Fetch all chats for a user
// @route   GET /api/chats
// @access  Private
exports.fetchChats = async (req, res) => {
    const currentUserId = req.user._id;
    console.log(`Backend fetchChats: Fetching all chats for user ${currentUserId}`);
    try {
        const chats = await Chat.find({ participants: { $elemMatch: { $eq: currentUserId } } })
            .populate("participants", "-password -otp -otpExpires")
            .populate("groupAdmins", "-password -otp -otpExpires")
            .populate({
                path: "lastMessage",
                populate: {
                    path: "sender",
                    select: "name profilePicture phoneNumber"
                }
            })
            .sort({ updatedAt: -1 }); // Sort by most recently updated

        console.log(`Backend fetchChats: Found ${chats.length} chats for user ${currentUserId}.`);
        res.status(200).json(chats); // Send as JSON
    } catch (error) {
        console.error("Backend fetchChats: Server error:", error);
        res.status(500).json({ message: "Server error fetching chats: " + error.message });
    }
};

// @desc    Get all messages for a specific chat
// @route   GET /api/chats/:chatId/messages
// @access  Private
exports.getChatMessages = async (req, res) => {
    const { chatId } = req.params;
    const currentUserId = req.user._id;
    console.log(`Backend getChatMessages: Fetching messages for chat ${chatId}, user ${currentUserId}`);

    try {
        // Optional: Check if the current user is a participant of the chat they are requesting messages for
        const chat = await Chat.findOne({ _id: chatId, participants: { $elemMatch: { $eq: currentUserId } } });
        if (!chat) {
            console.log(`Backend getChatMessages: User ${currentUserId} is not a participant of chat ${chatId} or chat does not exist.`);
            return res.status(403).json({ message: "Not authorized to access messages for this chat." });
        }

        const messages = await Message.find({ chatId: chatId })
            .populate("sender", "name profilePicture phoneNumber") // Populate sender details
            .populate("readBy", "name") // Populate users who read the message (just their name)
            .sort({ timestamp: 1 }); // Sort messages by timestamp (oldest first)

        console.log(`Backend getChatMessages: Found ${messages.length} messages for chat ${chatId}.`);
        res.status(200).json(messages);
    } catch (error) {
        console.error(`Backend getChatMessages: Server error for chat ${chatId}:`, error);
        if (error.name === 'CastError' && error.path === '_id') {
            return res.status(400).json({ message: "Invalid chat ID format." });
        }
        res.status(500).json({ message: "Server error fetching messages: " + error.message });
    }
};

// --- Group Chat Specific Controllers ---
// (Code for createGroupChat, renameGroup, addToGroup, removeFromGroup, addTaskToGroup, updateGroupTask remains largely the same as you provided,
// but ensure to add similar console.log statements for debugging if you work on those features next.)
// For brevity, I'm not re-pasting them here but remember to add logging when you focus on them.

exports.createGroupChat = async (req, res) => {
    console.log("Backend createGroupChat: Request received. Body:", req.body);
    if (!req.body.users || !req.body.name) {
        return res.status(400).send({ message: "Please fill all the fields (users, name)" });
    }

    let usersToParse = req.body.users;
    var users;
    try {
        users = typeof usersToParse === 'string' ? JSON.parse(usersToParse) : usersToParse;
        if (!Array.isArray(users)) throw new Error("Users must be an array.");
    } catch(e) {
        console.error("Backend createGroupChat: Failed to parse users array. Error:", e.message, "Received:", usersToParse);
        return res.status(400).send({ message: "Invalid users format. Must be a JSON array of user IDs." });
    }


    if (users.length < 1) { // A group needs at least 1 other member besides the creator
        return res
            .status(400)
            .send("More than 1 user is required to form a group chat (excluding creator).");
    }

    users.push(req.user._id.toString()); // Add the creator to the group, ensure it's a string if comparing later

    try {
        const groupChat = await Chat.create({
            name: req.body.name,
            participants: users, // Ensure all IDs are valid ObjectIds or strings that can be cast
            isGroupChat: true,
            groupAdmins: [req.user._id], // Creator is admin by default
        });
        console.log("Backend createGroupChat: Group chat created with ID:", groupChat._id);

        const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
            .populate("participants", "-password -otp -otpExpires")
            .populate("groupAdmins", "-password -otp -otpExpires");

        console.log("Backend createGroupChat: Sending full group chat details:", fullGroupChat._id);
        res.status(200).json(fullGroupChat);
    } catch (error) {
        console.error("Backend createGroupChat: Error creating group chat:", error);
        res.status(500).json({ message: "Server error creating group chat: " + error.message });
    }
};

// ... (Rest of your group controllers, add logging to them as well)
exports.renameGroup = async (req, res) => {
    const { chatId, chatName } = req.body;
    console.log(`Backend renameGroup: Request to rename chat ${chatId} to "${chatName}" by user ${req.user._id}`);
    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found"});
        if (!chat.isGroupChat) return res.status(400).json({ message: "Cannot rename a non-group chat." });
        if (!chat.groupAdmins.map(id => id.toString()).includes(req.user._id.toString())) {
            return res.status(403).json({ message: "Only admins can rename the group." });
        }

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { name: chatName },
            { new: true }
        )
            .populate("participants", "-password -otp -otpExpires")
            .populate("groupAdmins", "-password -otp -otpExpires");

        if (!updatedChat) {
            res.status(404).json({ message: "Chat Not Found after update attempt" });
        } else {
            console.log(`Backend renameGroup: Chat ${chatId} renamed successfully.`);
            res.json(updatedChat);
            // TODO: Emit socket event io.to(chatId).emit('groupNameChanged', { chatId, newName: chatName });
        }
    } catch(error) {
        console.error(`Backend renameGroup: Error for chat ${chatId}:`, error);
        res.status(500).json({ message: "Server error renaming group: " + error.message });
    }
};

exports.addToGroup = async (req, res) => {
    const { chatId, userId: userToAddId } = req.body;
    console.log(`Backend addToGroup: Request to add user ${userToAddId} to chat ${chatId} by admin ${req.user._id}`);
    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found"});
        if (!chat.isGroupChat) return res.status(400).json({ message: "Cannot add user to a non-group chat." });
        if (!chat.groupAdmins.map(id => id.toString()).includes(req.user._id.toString())) {
            return res.status(403).json({ message: "Only admins can add users to the group." });
        }
        if (chat.participants.map(id => id.toString()).includes(userToAddId.toString())) {
            return res.status(400).json({ message: "User already in group." });
        }

        const added = await Chat.findByIdAndUpdate(
            chatId,
            { $addToSet: { participants: userToAddId } }, // Use $addToSet to avoid duplicates
            { new: true }
        )
            .populate("participants", "-password -otp -otpExpires")
            .populate("groupAdmins", "-password -otp -otpExpires");

        if (!added) {
            res.status(404).json({ message: "Chat Not Found or failed to add user." });
        } else {
            console.log(`Backend addToGroup: User ${userToAddId} added to chat ${chatId}.`);
            res.json(added);
            // TODO: Emit socket event to group members (including new one)
            // io.to(chatId).emit('userAddedToGroup', { chatId, userAdded: { _id: userToAddId, name: ...}, addedBy: req.user._id });
        }
    } catch(error) {
        console.error(`Backend addToGroup: Error for chat ${chatId}, user ${userToAddId}:`, error);
        res.status(500).json({ message: "Server error adding user to group: " + error.message });
    }
};

exports.removeFromGroup = async (req, res) => {
    const { chatId, userId: userToRemoveId } = req.body;
    console.log(`Backend removeFromGroup: Request to remove user ${userToRemoveId} from chat ${chatId} by user ${req.user._id}`);

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found"});
        if (!chat.isGroupChat) return res.status(400).json({ message: "Cannot remove user from a non-group chat." });

        const isAdmin = chat.groupAdmins.map(id => id.toString()).includes(req.user._id.toString());
        const isSelfRemoval = req.user._id.toString() === userToRemoveId.toString();

        if (!isAdmin && !isSelfRemoval) {
             return res.status(403).json({ message: "Only admins can remove others, or you can remove yourself." });
        }
        if (isAdmin && chat.groupAdmins.map(id=>id.toString()).includes(userToRemoveId.toString()) && chat.groupAdmins.length === 1 && chat.participants.length > 1) {
            // If trying to remove the last admin, and other participants exist
            return res.status(400).json({ message: "Cannot remove the last admin if other participants exist. Promote another admin first or remove other participants." });
        }
        if (!chat.participants.map(id=>id.toString()).includes(userToRemoveId.toString())) {
            return res.status(400).json({ message: "User not found in this group." });
        }

        const removed = await Chat.findByIdAndUpdate(
            chatId,
            {
                $pull: { participants: userToRemoveId, groupAdmins: userToRemoveId },
            },
            { new: true }
        )
            .populate("participants", "-password -otp -otpExpires")
            .populate("groupAdmins", "-password -otp -otpExpires");

        if (!removed) {
            res.status(404).json({ message: "Chat Not Found or failed to remove user." });
        } else {
            console.log(`Backend removeFromGroup: User ${userToRemoveId} removed from chat ${chatId}.`);
            if (removed.participants.length === 0) {
                console.log(`Backend removeFromGroup: Chat ${chatId} is now empty, deleting chat.`);
                await Chat.findByIdAndDelete(chatId);
                // TODO: Emit socket event for group deletion io.emit('groupDeleted', { chatId }); (to admins or previous members)
                return res.json({ message: "Group removed as it became empty." });
            }
            if (removed.isGroupChat && removed.groupAdmins.length === 0 && removed.participants.length > 0) {
                console.log(`Backend removeFromGroup: No admins left in group ${chatId}, promoting first participant.`);
                removed.groupAdmins.push(removed.participants[0]._id); // Promote the first participant (ObjectID)
                await removed.save();
                // Re-populate to get the latest state for the response
                const repopulatedChat = await Chat.findById(removed._id)
                                               .populate("participants", "-password -otp -otpExpires")
                                               .populate("groupAdmins", "-password -otp -otpExpires");
                return res.json(repopulatedChat);
            }
            res.json(removed);
            // TODO: Emit socket event to group members
            // io.to(chatId).emit('userRemovedFromGroup', { chatId, userRemovedId, removedBy: req.user._id });
        }
    } catch (error) {
        console.error(`Backend removeFromGroup: Error for chat ${chatId}, user ${userToRemoveId}:`, error);
        res.status(500).json({ message: "Server error removing user from group: " + error.message });
    }
};

exports.addTaskToGroup = async (req, res) => { /* ... Add logging ... */ };
exports.updateGroupTask = async (req, res) => { /* ... Add logging ... */ };
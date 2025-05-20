// server/controllers/chatController.js
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const mongoose = require('mongoose');

const userPopulateFields = "name profilePicture email _id createdAt online lastSeen";

const emitSystemMessage = (req, chatId, textContent) => {
    const io = req.app.get('socketio');
    if (io && chatId && textContent) {
        const systemMessage = {
            _id: new mongoose.Types.ObjectId(),
            chatId: chatId.toString(),
            type: 'system',
            content: { text: textContent },
            sender: null,
            timestamp: new Date(),
            isSystemMessage: true,
            readBy: [],
        };
        io.to(chatId.toString()).emit('receiveMessage', systemMessage);
        console.log(`System message emitted to chat ${chatId}: "${textContent}"`);
    } else {
        console.warn("Failed to emit system message. IO or chatId or textContent missing.", { ioExists: !!io, chatId, textContent });
    }
};

exports.accessChat = async (req, res) => {
    const { userId: targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
        return res.status(400).json({ message: "UserId param not sent" });
    }
    if (currentUserId.toString() === targetUserId.toString()) {
        return res.status(400).json({ message: "Cannot create chat with yourself." });
    }

    try {
        let existingChat = await Chat.findOne({
            isGroupChat: false,
            $and: [
                { participants: { $elemMatch: { $eq: currentUserId } } },
                { participants: { $elemMatch: { $eq: targetUserId } } },
            ],
        })
        .populate("participants", userPopulateFields)
        .populate({
            path: "lastMessage",
            populate: { path: "sender", select: userPopulateFields }
        });

        if (existingChat) {
            return res.status(200).json(existingChat);
        } else {
            const chatData = {
                isGroupChat: false,
                participants: [currentUserId, targetUserId],
            };
            const createdChat = await Chat.create(chatData);
            const fullNewChat = await Chat.findById(createdChat._id)
                .populate("participants", userPopulateFields);
            return res.status(200).json(fullNewChat);
        }
    } catch (error) {
        console.error("accessChat error:", error.message, error.stack);
        res.status(500).json({ message: "Server error accessing chat." });
    }
};

exports.fetchChats = async (req, res) => {
    try {
        const chats = await Chat.find({ participants: { $elemMatch: { $eq: req.user._id } } })
            .populate("participants", userPopulateFields)
            .populate("groupAdmins", userPopulateFields)
            .populate("createdBy", userPopulateFields)
            .populate({
                path: "lastMessage",
                populate: { path: "sender", select: userPopulateFields }
            })
            .sort({ updatedAt: -1 });
        res.status(200).json(chats);
    } catch (error) {
        console.error("fetchChats error:", error.message, error.stack);
        res.status(500).json({ message: "Server error fetching chats." });
    }
};

exports.getChatMessages = async (req, res) => {
    try {
         const chat = await Chat.findOne({ _id: req.params.chatId, participants: { $elemMatch: { $eq: req.user._id } } });
         if (!chat) {
             return res.status(403).json({ message: "Not authorized or chat not found." });
         }
        const messages = await Message.find({ chatId: req.params.chatId })
            .populate("sender", userPopulateFields)
            .populate("readBy", "name _id") // Keep this lean or use userPopulateFields if more info needed
            .sort({ timestamp: 1 });
        res.status(200).json(messages);
    } catch (error) {
        console.error("getChatMessages error:", error.message, error.stack);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid chat ID format." });
        }
        res.status(500).json({ message: "Server error fetching messages." });
    }
};

exports.createGroupChat = async (req, res) => {
    if (!req.body.users || !req.body.name) {
        return res.status(400).send({ message: "Please provide group name and users" });
    }
    let usersFromRequest;
    try {
        usersFromRequest = typeof req.body.users === 'string' ? JSON.parse(req.body.users) : req.body.users;
        if (!Array.isArray(usersFromRequest)) throw new Error("Users must be an array.");
    } catch (e) {
        return res.status(400).send({ message: "Invalid users format." });
    }

    if (usersFromRequest.length < 1) {
        return res.status(400).send("More than 1 user required for a group (excluding creator).");
    }

    const currentUserId = req.user._id.toString();
    const currentUserName = req.user.name;
    const finalUserIds = Array.from(new Set([...usersFromRequest.map(u => u.toString()), currentUserId])); // Ensure all are strings

    try {
        const groupChat = await Chat.create({
            name: req.body.name,
            participants: finalUserIds,
            isGroupChat: true,
            groupAdmins: [currentUserId],
            createdBy: currentUserId,
        });

        const fullGroupChat = await Chat.findById(groupChat._id)
            .populate("participants", userPopulateFields)
            .populate("groupAdmins", userPopulateFields)
            .populate("createdBy", userPopulateFields);

        emitSystemMessage(req, fullGroupChat._id, `${currentUserName} created the group "${fullGroupChat.name}"`);
        res.status(200).json(fullGroupChat);
    } catch (error) {
        console.error("createGroupChat error:", error.message, error.stack);
        res.status(500).json({ message: "Server error creating group." });
    }
};

exports.renameGroup = async (req, res) => {
    const { chatId, chatName } = req.body;
    const currentUserName = req.user.name;
    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found." });
        if (!chat.isGroupChat) return res.status(400).json({ message: "Not a group chat." });
        if (!chat.groupAdmins.map(id => id.toString()).includes(req.user._id.toString())) {
            return res.status(403).json({ message: "Only admins can rename the group." });
        }

        const updatedChat = await Chat.findByIdAndUpdate(chatId, { name: chatName }, { new: true })
            .populate("participants", userPopulateFields)
            .populate("groupAdmins", userPopulateFields)
            .populate("createdBy", userPopulateFields);
        
        if (!updatedChat) return res.status(404).json({ message: "Failed to update group name." });
        emitSystemMessage(req, chatId, `${currentUserName} renamed the group to "${chatName}"`);
        res.json(updatedChat);
    } catch (error) {
        console.error("renameGroup error:", error.message, error.stack);
        res.status(500).json({ message: "Server error renaming group." });
    }
};

exports.addToGroup = async (req, res) => {
    const { chatId, userId: userToAddId } = req.body;
    const currentUserId = req.user._id.toString();
    const currentUserName = req.user.name;

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found." });
        if (!chat.isGroupChat) return res.status(400).json({ message: "Not a group chat." });
        if (!chat.groupAdmins.map(id => id.toString()).includes(currentUserId)) {
            return res.status(403).json({ message: "Only admins can add users." });
        }
        if (chat.participants.some(p => p._id.toString() === userToAddId.toString())) {
            return res.status(400).json({ message: "User already in group." });
        }
        const userToAdd = await User.findById(userToAddId).select(userPopulateFields); // select name for system message
        if (!userToAdd) return res.status(404).json({ message: "User to add not found." });

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $addToSet: { participants: userToAddId } }, // Mongoose will cast string to ObjectId
            { new: true }
        )
        .populate("participants", userPopulateFields)
        .populate("groupAdmins", userPopulateFields)
        .populate("createdBy", userPopulateFields);
        
        if (!updatedChat) return res.status(404).json({ message: "Failed to add user to group." });
        emitSystemMessage(req, chatId, `${currentUserName} added ${userToAdd.name} to the group.`);
        res.json(updatedChat);
    } catch (error) {
        console.error("addToGroup error:", error.message, error.stack);
        res.status(500).json({ message: "Server error adding to group." });
    }
};

exports.removeFromGroup = async (req, res) => {
    const { chatId, userId: userToRemoveId } = req.body;
    const currentUserId = req.user._id.toString();
    const currentUserName = req.user.name;

    try {
        let chat = await Chat.findById(chatId);
        if (!chat || !chat.isGroupChat) {
            return res.status(404).json({ message: "Group chat not found." });
        }

        const isAdminPerformingAction = chat.groupAdmins.some(admin => admin._id.toString() === currentUserId);
        const isSelfRemoval = currentUserId === userToRemoveId.toString();

        if (!isAdminPerformingAction && !isSelfRemoval) {
            return res.status(403).json({ message: "Not authorized to remove this user." });
        }
        if (!chat.participants.some(p => p._id.toString() === userToRemoveId.toString())) {
            return res.status(400).json({ message: "User not in this group." });
        }

        const userToRemoveDetails = await User.findById(userToRemoveId).select("name"); // For system message
        if (!userToRemoveDetails) return res.status(404).json({ message: "User to remove details not found." });

        if (chat.groupAdmins.some(admin => admin._id.toString() === userToRemoveId.toString()) &&
            chat.groupAdmins.length === 1 &&
            chat.participants.length > 1 && // Ensure there are other participants
            userToRemoveId.toString() !== chat.createdBy._id.toString() // Allow creator to be last admin if they are also last participant.
        ) {
             // More complex logic: if removing the last admin, who is not the creator, and others exist
            if (userToRemoveId.toString() !== chat.createdBy._id.toString()) {
                 return res.status(400).json({ message: "Cannot remove the last admin if other participants exist and it's not the creator. Promote another admin first." });
            }
        }


        let updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $pull: { participants: userToRemoveId, groupAdmins: userToRemoveId } },
            { new: true }
        );

        if (!updatedChat) return res.status(404).json({ message: "Failed to update chat after removal." });

        let systemMsgText = isSelfRemoval ? `${userToRemoveDetails.name} left the group.` : `${currentUserName} removed ${userToRemoveDetails.name} from the group.`;
        emitSystemMessage(req, chatId, systemMsgText);

        if (updatedChat.participants.length === 0) {
            await Chat.findByIdAndDelete(chatId);
            return res.json({ message: "Group removed as it became empty.", deletedChatId: chatId });
        }
        
        if (updatedChat.groupAdmins.length === 0 && updatedChat.participants.length > 0) {
            console.log(`No admins left in group ${chatId}, attempting to auto-promote.`);
            let newAdminIdToPush;
            // Prefer creator if still a participant
            const creatorIsParticipant = updatedChat.participants.some(p => p._id.toString() === updatedChat.createdBy?._id.toString());

            if (updatedChat.createdBy && creatorIsParticipant) {
                newAdminIdToPush = updatedChat.createdBy._id; // This is ObjectId
            } else {
                newAdminIdToPush = updatedChat.participants[0]._id; // This is ObjectId from populated participant
            }
            if (newAdminIdToPush) {
                updatedChat.groupAdmins.push(newAdminIdToPush);
                await updatedChat.save();
                console.log(`User ${newAdminIdToPush} auto-promoted to admin.`);
                 const promotedAdminDetails = await User.findById(newAdminIdToPush).select("name");
                 emitSystemMessage(req, chatId, `${promotedAdminDetails.name} was automatically made an admin.`);
            } else {
                 console.warn("Could not find a user to auto-promote to admin.");
            }
        }

        // Re-populate everything to ensure consistent data structure in response
        updatedChat = await Chat.findById(updatedChat._id)
            .populate("participants", userPopulateFields)
            .populate("groupAdmins", userPopulateFields)
            .populate("createdBy", userPopulateFields);

        res.json(updatedChat);
    } catch (error) {
        console.error("removeFromGroup error:", error.message, error.stack);
        res.status(500).json({ message: "Server error removing from group." });
    }
};

exports.promoteToGroupAdmin = async (req, res) => {
    const { chatId, userId: userIdToPromote } = req.body;
    const currentUserId = req.user._id.toString();
    const currentUserName = req.user.name;

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Chat not found." });
        if (!chat.isGroupChat) return res.status(400).json({ message: "Not a group chat." });
        if (!chat.groupAdmins.some(admin => admin._id.toString() === currentUserId)) {
            return res.status(403).json({ message: "Only admins can promote." });
        }
        if (!chat.participants.some(p => p._id.toString() === userIdToPromote.toString())) {
            return res.status(400).json({ message: "User not a participant." });
        }
        if (chat.groupAdmins.some(admin => admin._id.toString() === userIdToPromote.toString())) {
            return res.status(400).json({ message: "User is already an admin." });
        }
        const userToPromoteDetails = await User.findById(userIdToPromote).select("name");
        if(!userToPromoteDetails) return res.status(404).json({message: "User to promote details not found."});

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $addToSet: { groupAdmins: userIdToPromote } },
            { new: true }
        )
        .populate("participants", userPopulateFields)
        .populate("groupAdmins", userPopulateFields)
        .populate("createdBy", userPopulateFields);

        if(!updatedChat) return res.status(500).json({message: "Failed to update chat after promotion."})

        emitSystemMessage(req, chatId, `${currentUserName} made ${userToPromoteDetails.name} an admin.`);
        res.json(updatedChat);
    } catch (error) {
        console.error("promoteToGroupAdmin error:", error.message, error.stack);
        res.status(500).json({ message: "Server error promoting admin." });
    }
};

exports.demoteFromGroupAdmin = async (req, res) => {
    const { chatId, userId: userIdToDemote } = req.body;
    const currentUserId = req.user._id.toString();
    const currentUserName = req.user.name;

    try {
        let chat = await Chat.findById(chatId); // Fetch chat to check details
        if (!chat) return res.status(404).json({ message: "Chat not found." });
        if (!chat.isGroupChat) return res.status(400).json({ message: "Not a group chat." });
        if (!chat.groupAdmins.some(admin => admin._id.toString() === currentUserId)) {
            return res.status(403).json({ message: "Only admins can demote." });
        }
        if (!chat.groupAdmins.some(admin => admin._id.toString() === userIdToDemote.toString())) {
            return res.status(400).json({ message: "User is not an admin." });
        }

        // Prevent demoting the creator if they are the only admin
        if (chat.groupAdmins.length === 1 && userIdToDemote.toString() === chat.createdBy?._id.toString()) {
            return res.status(400).json({ message: "Cannot demote the creator if they are the only admin." });
        }
        // Prevent demoting self if last admin
        if (chat.groupAdmins.length === 1 && userIdToDemote.toString() === currentUserId) {
             return res.status(400).json({ message: "Cannot demote yourself if you are the last admin. Promote another admin first." });
        }


        const userToDemoteDetails = await User.findById(userIdToDemote).select("name");
        if(!userToDemoteDetails) return res.status(404).json({message: "User to demote details not found."});

        let updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { $pull: { groupAdmins: userIdToDemote } },
            { new: true } // Get the updated document
        );

        if (!updatedChat) return res.status(500).json({ message: "Failed to update chat after demotion." });

        emitSystemMessage(req, chatId, `${currentUserName} removed ${userToDemoteDetails.name} as an admin.`);
        
        if (updatedChat.groupAdmins.length === 0 && updatedChat.participants.length > 0) {
            console.log(`No admins left in group ${chatId} after demotion, attempting to auto-promote.`);
            let newAdminIdToPush;
            const creatorIsParticipant = updatedChat.participants.some(p => p._id.toString() === updatedChat.createdBy?._id.toString());

            if (updatedChat.createdBy && creatorIsParticipant) {
                newAdminIdToPush = updatedChat.createdBy._id;
            } else if (updatedChat.participants.length > 0) { // Ensure there's at least one participant
                newAdminIdToPush = updatedChat.participants[0]._id;
            }

            if (newAdminIdToPush) {
                updatedChat.groupAdmins.push(newAdminIdToPush);
                await updatedChat.save(); // Save the change to groupAdmins
                console.log(`User ${newAdminIdToPush} auto-promoted to admin after demotion.`);
                const promotedAdminDetails = await User.findById(newAdminIdToPush).select("name");
                emitSystemMessage(req, chatId, `${promotedAdminDetails.name} was automatically made an admin.`);
            } else {
                console.warn("Could not find a user to auto-promote to admin after demotion.");
            }
        }
        
        // Re-populate after all potential modifications
        updatedChat = await Chat.findById(updatedChat._id)
            .populate("participants", userPopulateFields)
            .populate("groupAdmins", userPopulateFields)
            .populate("createdBy", userPopulateFields);

        res.json(updatedChat);
    } catch (error) {
        console.error("demoteFromGroupAdmin error:", error.message, error.stack);
        res.status(500).json({ message: "Server error demoting admin." });
    }
};

exports.addTaskToGroup = async (req, res) => { res.status(501).send("Not Implemented"); };
exports.updateGroupTask = async (req, res) => { res.status(501).send("Not Implemented");};
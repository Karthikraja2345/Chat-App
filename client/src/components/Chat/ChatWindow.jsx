// client/src/components/Chat/ChatWindow.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import GroupInfoModal from '../Group/GroupInfoModal';
import UserProfileModal from '../User/UserProfileModal';
import { FaUsersCog, FaInfoCircle } from 'react-icons/fa'; // Icons for info buttons
// Assuming ChatWindow.css is not used if ChatPage.css styles this component
import './ChatWindow.css'; // Remove if styles are in ChatPage.css or a global file

const ChatWindow = ({
    chat,
    messages,
    loadingMessages,
    currentUser,
    onSendMessage,
    newMessage,
    onNewMessageChange,
    typingIndicator,
    onChatUpdated, // For updating chat details (e.g., after group info change)
    onFileSelectedForPreview, // For file uploads
    isFileBeingProcessed,     // True if file dialog is open OR actual upload is in progress
    isActuallyUploading,      // True if network request for upload is in progress
}) => {
    const messagesEndRef = useRef(null);
    const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
    const [showUserProfileModal, setShowUserProfileModal] = useState(false);
    const [selectedProfileUser, setSelectedProfileUser] = useState(null);

    // Auto-scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Function to get the chat partner in a 1-on-1 chat
    // This will re-run on every render, but its dependencies (currentUser, chat) determine if chatPartner changes.
    const getChatPartner = useCallback(() => {
        if (currentUser && chat && !chat.isGroupChat && chat.participants) {
            return chat.participants.find(p => p._id !== currentUser._id);
        }
        return null;
    }, [currentUser, chat]); // chat is a prop, currentUser is from context (likely stable)

    const chatPartner = getChatPartner(); // Call the memoized function

    // Callback for when chat details are updated from within a modal
    const handleChatUpdatedInModal = useCallback((updatedChatData) => {
        if (onChatUpdated) { // onChatUpdated prop from ChatPage
            onChatUpdated(updatedChatData);
        }
    }, [onChatUpdated]);

    // Callback to open the appropriate info modal (group or user profile)
    const handleOpenInfoModal = useCallback(() => {
        if (chat?.isGroupChat) {
            setShowGroupInfoModal(true);
        } else if (chatPartner) {
            setSelectedProfileUser(chatPartner);
            setShowUserProfileModal(true);
        }
    }, [chat?.isGroupChat, chatPartner]);

    const handleCloseGroupInfoModal = useCallback(() => setShowGroupInfoModal(false), []);
    const handleCloseUserProfileModal = useCallback(() => {
        setShowUserProfileModal(false);
        setSelectedProfileUser(null);
    }, []);

    // Early return if no chat is selected. MUST BE AFTER ALL HOOK CALLS.
    if (!chat || !chat._id) {
        // Using class names from ChatPage.css for placeholder
        return (
            <div className="chat-window-container no-chat-selected">
                <p>Select a chat to start messaging.</p>
            </div>
        );
    }

    // Determine chat name and avatar
    const chatName = chat.isGroupChat ? chat.name : chatPartner?.name || "Chat";
    // Fallback avatars using ui-avatars or local defaults
    const defaultGroupAvatar = "src/assets/group.png";
    const defaultUserAvatar = "src/assets/male.png";

    const chatAvatarSrc = chat.isGroupChat
        ? chat.groupIcon || chat.groupPic || defaultGroupAvatar // Prioritize groupIcon, then groupPic
        :  defaultUserAvatar;

    return (
        <div className="chat-window-container">
            <div className="chat-header">
                <img src={chatAvatarSrc} alt={`${chatName} avatar`} className="avatar small-avatar" />
                <div className="chat-info">
                    <h3>{chatName}</h3>
                    {/* Display typing indicator or file processing status or member/online status */}
                    {typingIndicator && (
                        <small className="typing-indicator">{typingIndicator}</small>
                    )}
                    {!typingIndicator && isFileBeingProcessed && (
                        <small className="typing-indicator" style={{ fontStyle: 'italic', color: isActuallyUploading ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                            {isActuallyUploading ? 'Uploading file...' : 'Preparing file...'}
                        </small>
                    )}
                    {!typingIndicator && !isFileBeingProcessed && chat.isGroupChat && chat.participants && (
                        <small>{chat.participants.length} members</small>
                    )}
                    {!typingIndicator && !isFileBeingProcessed && !chat.isGroupChat && chatPartner?.online && (
                        <small style={{ color: 'var(--accent-color)' }}>Online</small>
                    )}
                    {!typingIndicator && !isFileBeingProcessed && !chat.isGroupChat && !chatPartner?.online && chatPartner?.lastSeen && (
                        <small>Last seen {new Date(chatPartner.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    )}
                </div>
                {/* Info button for group or user profile */}
                {(chat.isGroupChat || (!chat.isGroupChat && chatPartner)) && (
                    <div className="chat-header-actions"> {/* Wrapper for potential multiple actions */}
                        <button
                            onClick={handleOpenInfoModal}
                            className="chat-action-btn" // Ensure .chat-action-btn is styled in ChatPage.css
                            title={chat.isGroupChat ? "Group Information" : "User Information"}
                        >
                            {chat.isGroupChat ? <FaUsersCog size={20} /> : <FaInfoCircle size={20} />}
                        </button>
                    </div>
                )}
            </div>

            <MessageList
                messages={messages}
                currentUser={currentUser}
                loading={loadingMessages}
                chat={chat} // Pass chat to MessageList if it needs participant info for sender names
            />
            <div ref={messagesEndRef} /> {/* For auto-scrolling */}

            <MessageInput
                newMessage={newMessage}
                onNewMessageChange={onNewMessageChange} // Expected to be `handleTyping` from ChatPage
                onSendMessage={onSendMessage}           // Expected to be `handleSendMessage` from ChatPage
                onFileSelectedForPreview={onFileSelectedForPreview}
                isFileBeingProcessed={isFileBeingProcessed}
                // Note: MessageInput doesn't directly use `isActuallyUploading`, but `isFileBeingProcessed` covers its disabled state.
            />

            {/* Modals for group info and user profile */}
            {chat.isGroupChat && showGroupInfoModal && currentUser && (
                <GroupInfoModal
                    chat={chat}
                    currentUser={currentUser} // Pass currentUser if modal needs it (e.g. for admin checks)
                    onClose={handleCloseGroupInfoModal}
                    onGroupUpdated={handleChatUpdatedInModal}
                />
            )}
            {!chat.isGroupChat && showUserProfileModal && selectedProfileUser && (
                <UserProfileModal
                    user={selectedProfileUser}
                    onClose={handleCloseUserProfileModal}
                />
            )}
        </div>
    );
};

export default ChatWindow;
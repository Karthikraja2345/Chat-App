// client/src/components/Chat/ChatWindow.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import GroupInfoModal from '../Group/GroupInfoModal';
import UserProfileModal from '../User/UserProfileModal';
import { FaUsersCog, FaInfoCircle } from 'react-icons/fa';
import './ChatWindow.css';

const ChatWindow = ({
    chat,
    messages,
    loadingMessages,
    currentUser,
    onSendMessage,
    newMessage,
    onNewMessageChange,
    typingIndicator,
    onFileSelectedForPreview,
    isFileBeingProcessed, // This prop means "dialog is open OR actual upload is in progress"
    isActuallyUploading,  // This prop means "network request for upload is in progress"
}) => {
    const messagesEndRef = useRef(null);
    const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
    const [showUserProfileModal, setShowUserProfileModal] = useState(false);
    const [selectedProfileUser, setSelectedProfileUser] = useState(null);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    if (!chat) {
        return <div className="chat-window placeholder no-chat-selected"><p>Select a chat to start messaging.</p></div>;
    }

    const getChatPartner = (chatToProcess) => {
        if (chatToProcess && !chatToProcess.isGroupChat && chatToProcess.participants) {
            return chatToProcess.participants.find(p => p._id !== currentUser._id);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Moved getChatPartner outside of useCallback as it's used to define chatPartner
    // which is then used in other useCallback dependencies.
    // This function will re-run on every render of ChatWindow.
    const getChatPartnerFn = () => {
        if (currentUser && chat && !chat.isGroupChat && chat.participants) {
            return chat.participants.find(p => p._id !== currentUser._id);

        }
        return null;
    };
    


    const chatPartner = !chat.isGroupChat ? getChatPartner(chat) : null;
    const chatName = chat.isGroupChat ? chat.name : chatPartner?.name || "Chat";
    const chatAvatarSrc = chat.isGroupChat
        ? chat.groupIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name || 'G')}&background=random&size=40`
        : chatPartner?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(chatPartner?.name || '?')}&background=random&size=40`;

    const handleChatUpdatedInModal = useCallback((updatedChatData) => {
        if (onChatUpdated) { // onChatUpdated prop should be stable from ChatPage
            onChatUpdated(updatedChatData);
        }
    }, [onChatUpdated]);

    const handleOpenInfoModal = useCallback(() => {
        if (chat?.isGroupChat) { // Use optional chaining on chat
            setShowGroupInfoModal(true);
        } else if (chatPartner) { // chatPartner is stable if getChatPartnerFn's inputs are stable
            setSelectedProfileUser(chatPartner);
            setShowUserProfileModal(true);
        }
    }, [chat?.isGroupChat, chatPartner]); // Depends on these derived values

    const handleCloseGroupInfoModal = useCallback(() => setShowGroupInfoModal(false), []);
    const handleCloseUserProfileModal = useCallback(() => { setShowUserProfileModal(false); setSelectedProfileUser(null); }, []);

    // Early return MUST be AFTER all hook calls
    if (!chat || !chat._id) {
        return <div className="chat-window-container placeholder"><div className="no-chat-selected"><p>Select a chat.</p></div></div>;
    }

    const chatName = chat.isGroupChat ? chat.name : chatPartner?.name || "Chat";
    const chatAvatar = chat.isGroupChat ? chat.groupPic || '/default-group-avatar.png' : chatPartner?.profilePicture || '/default-avatar.png';


    return (
        <div className="chat-window-container">
            <div className="chat-header">
           
                <img src="src/assets/male.png" alt={chatName} className="avatar chat-header-avatar" />
                <div className="chat-info">
                    <h3>{chatName}</h3>
                    {typingIndicator && <small className="typing-indicator" style={{ fontStyle: 'italic', color: 'gray' }}>{typingIndicator}</small>}
                    {!typingIndicator && chat.isGroupChat && chat.participants && (<small>{chat.participants.length} members</small>)}
                    {!typingIndicator && !chat.isGroupChat && chatPartner?.online && (<small style={{ color: 'green' }}>Online</small>)}
                    {!typingIndicator && !chat.isGroupChat && !chatPartner?.online && chatPartner?.lastSeen && (<small>Last seen {new Date(chatPartner.lastSeen).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small>)}
                </div>
                {(chat.isGroupChat || (!chat.isGroupChat && chatPartner)) && (
                    <button onClick={handleOpenInfoModal} className="chat-action-btn info-btn" title={chat.isGroupChat ? "Group Information" : "User Information"}>
                        {chat.isGroupChat ? <FaUsersCog size={20} /> : <FaInfoCircle size={20} />}
                    </button>
                )}
            </div>

            <MessageList messages={messages} currentUser={currentUser} loading={loadingMessages} />
            <div ref={messagesEndRef} />
            <MessageInput newMessage={newMessage} onNewMessageChange={onNewMessageChange} onSendMessage={onSendMessage} />

            {chat.isGroupChat && showGroupInfoModal && currentUser && (
                <GroupInfoModal
                    chat={chat}
                    onClose={handleCloseGroupInfoModal} // Memoized
                    onGroupUpdated={handleChatUpdatedInModal} // Uses memoized onChatUpdated from parent
                />
            )}
            {!chat.isGroupChat && showUserProfileModal && selectedProfileUser && (
                <UserProfileModal user={selectedProfileUser} onClose={handleCloseUserProfileModal} /> // Memoized
            )}

        </div>
    );
};
export default ChatWindow;
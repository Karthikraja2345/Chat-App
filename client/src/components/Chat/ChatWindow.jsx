// src/components/Chat/ChatWindow.jsx
import React, { useRef, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './ChatPage.css';

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
        }
        return null;
    };

    const chatPartner = !chat.isGroupChat ? getChatPartner(chat) : null;
    const chatName = chat.isGroupChat ? chat.name : chatPartner?.name || "Chat";
    const chatAvatarSrc = chat.isGroupChat
        ? chat.groupIcon || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name || 'G')}&background=random&size=40`
        : chatPartner?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(chatPartner?.name || '?')}&background=random&size=40`;

    return (
        <div className="chat-window-container">
            <div className="chat-header">
                <img src="src/assets/male.png" alt={`${chatName} avatar`} className="avatar small-avatar" />
                <div className="chat-info">
                    <h3>{chatName}</h3>
                    {typingIndicator && <small className="typing-indicator">{typingIndicator}</small>}
                    {!typingIndicator && isFileBeingProcessed && <small className="typing-indicator" style={{ fontStyle: 'italic', color: isActuallyUploading ? '#007bff' : '#6c757d' }}>
                        {isActuallyUploading ? 'Uploading file...' : 'Preparing file...'}
                    </small>}
                    {!typingIndicator && !isFileBeingProcessed && chat.isGroupChat && (
                        <small>{chat.participants?.length} members</small>
                    )}
                     {!typingIndicator && !isFileBeingProcessed && !chat.isGroupChat && chatPartner?.online && (
                        <small style={{color: 'green'}}>Online</small>
                    )}
                    {!typingIndicator && !isFileBeingProcessed && !chat.isGroupChat && !chatPartner?.online && chatPartner?.lastSeen && (
                        <small>Last seen {new Date(chatPartner.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    )}
                </div>
            </div>

            <MessageList
                messages={messages}
                currentUser={currentUser}
                loading={loadingMessages}
                chat={chat}
            />
            <div ref={messagesEndRef} />

            <MessageInput
                newMessage={newMessage}
                onNewMessageChange={onNewMessageChange}
                onSendMessage={onSendMessage}
                onFileSelectedForPreview={onFileSelectedForPreview}
                isFileBeingProcessed={isFileBeingProcessed}
            />
        </div>
    );
};

export default ChatWindow;
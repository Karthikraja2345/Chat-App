// src/components/Chat/ChatWindow.jsx
import React, { useRef, useEffect } from 'react';
import MessageList from './MessageList'; // Assuming MessageList is in the same folder
import MessageInput from './MessageInput'; // Assuming MessageInput is in the same folder
import './ChatPage.css'; // Or a specific ChatWindow.css

const ChatWindow = ({
    chat,
    messages,
    loadingMessages,
    currentUser,
    onSendMessage,
    newMessage,
    onNewMessageChange,
    typingIndicator,
    // Add props for file upload, payment split trigger etc.
    // onImageUpload, onPdfUpload, onPaymentSplit
}) => {
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]); // Scroll to bottom when new messages arrive

    if (!chat) {
        return <div className="chat-window placeholder">Select a chat to start messaging.</div>;
    }

    // Function to get the other participant in a 1-on-1 chat
    const getChatPartner = (chatToProcess) => {
        if (chatToProcess && !chatToProcess.isGroupChat && chatToProcess.participants) {
            return chatToProcess.participants.find(p => p._id !== currentUser._id);
        }
        return null;
    };

    const chatName = chat.isGroupChat ? chat.name : getChatPartner(chat)?.name || "Chat";
    const chatAvatar = chat.isGroupChat
        ? chat.groupIcon || 'https://via.placeholder.com/40?text=G'
        : getChatPartner(chat)?.profilePicture || 'https://via.placeholder.com/40?text=?';


    return (
        <div className="chat-window-container">
            <div className="chat-header">
                <img src={chatAvatar} alt="avatar" className="avatar small-avatar" />
                <div className="chat-info">
                    <h3>{chatName}</h3>
                    {typingIndicator && <small className="typing-indicator">{typingIndicator}</small>}
                    {!typingIndicator && chat.isGroupChat && (
                        <small>{chat.participants?.length} members</small>
                    )}
                     {!typingIndicator && !chat.isGroupChat && getChatPartner(chat)?.online && (
                        <small style={{color: 'green'}}>Online</small>
                    )}
                    {!typingIndicator && !chat.isGroupChat && !getChatPartner(chat)?.online && getChatPartner(chat)?.lastSeen && (
                        <small>Last seen {new Date(getChatPartner(chat).lastSeen).toLocaleTimeString()}</small>
                    )}
                </div>
                {/* Add more icons for info, call, etc. */}
            </div>

            <MessageList
                messages={messages}
                currentUser={currentUser}
                loading={loadingMessages}
            />
            <div ref={messagesEndRef} /> {/* Element to scroll to */}

            <MessageInput
                newMessage={newMessage}
                onNewMessageChange={onNewMessageChange}
                onSendMessage={onSendMessage}
                // Pass handlers for attachments
                // onImageUpload={onImageUpload}
                // onPdfUpload={onPdfUpload}
                // onPaymentSplit={onPaymentSplit}
            />
        </div>
    );
};

export default ChatWindow;
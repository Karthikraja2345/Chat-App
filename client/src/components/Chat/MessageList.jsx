// src/components/Chat/MessageList.jsx
import React from 'react';
import MessageBubble from './MessageBubble'; // Assuming MessageBubble is in the same folder
import './ChatPage.css'; // Or a specific MessageList.css

const MessageList = ({ messages, currentUser, loading }) => {
    if (loading) {
        return <div className="loading-spinner">Loading messages...</div>;
    }

    if (!messages || messages.length === 0) {
        return <div className="message-list-container no-messages">No messages yet. Start the conversation!</div>;
    }

    return (
        <div className="message-list-container">
            {messages.map((msg) => (
                <MessageBubble
                    key={msg._id}
                    message={msg}
                    isCurrentUser={msg.sender && msg.sender._id === currentUser._id}
                    // Pass sender directly if not always populated or for consistency
                    // sender={msg.sender}
                />
            ))}
        </div>
    );
};

export default MessageList;
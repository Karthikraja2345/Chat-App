// src/components/Chat/MessageList.jsx
import React, { useEffect, useRef } from 'react';
import { formatDistanceToNowStrict } from 'date-fns'; // For relative timestamps
import './ChatPage.css'; // Or a specific MessageList.css

const MessageList = ({ messages, currentUser, loading }) => {
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" }); // "auto" can be better during initial load
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]); // Scroll whenever messages change

    const getMessageStatusText = (message) => {
        if (message.sender._id !== currentUser._id) return null; // Only show status for sent messages

        if (message.status === 'read') return <span className="message-status read">Read</span>;
        // if (message.status === 'delivered') return <span className="message-status delivered">Delivered</span>; // Optional
        if (message.status === 'sent') return <span className="message-status sent">Sent</span>;
        return null;
    };

    if (loading) {
        return <div className="loading-spinner">Loading messages...</div>;
    }

    if (!messages || messages.length === 0) {
        return <div className="message-list-container no-messages">No messages yet. Start the conversation!</div>;
    }


    return (
        <div className="message-list-container">
            {messages.map((msg) => {
                const isSender = msg.sender && msg.sender._id === currentUser._id;
                const timestamp = new Date(msg.timestamp);

                return (
                    <div
                        key={msg._id}
                        className={`message-bubble ${isSender ? 'sent' : 'received'}`}
                    >
                        {!isSender && msg.sender && (
                            <div style={{ fontSize: '0.8em', fontWeight: 'bold', marginBottom: '3px', color: '#555' }}>
                                {msg.sender.name}
                            </div>
                        )}
                        {msg.type === 'text' && msg.content.text}
                        {msg.type === 'image' && msg.content.image && (
                            <img src={msg.content.image} alt="sent" style={{ maxWidth: '200px', borderRadius: '8px', marginTop: '5px' }} />
                        )}
                        {msg.type === 'pdf' && msg.content.pdf && (
                            <a href={msg.content.pdf} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '5px', color: isSender ? '#fff': '#007bff', textDecoration: 'underline'}}>
                                View PDF: {msg.content.pdf.split('/').pop().substring(0,20)}...
                            </a>
                        )}
                        {msg.type === 'payment_split' && msg.paymentDetails && (
                            <div className="payment-split-message" style={{border: '1px solid #eee', padding: '8px', borderRadius: '5px', marginTop:'5px', background: isSender ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.02)'}}>
                                <strong>Payment Split:</strong> {msg.paymentDetails.description}
                                <br/>
                                Amount: {msg.paymentDetails.amount}
                                <br/>
                                {msg.paymentDetails.upiLink && (
                                    <a href={msg.paymentDetails.upiLink} target="_blank" rel="noopener noreferrer" style={{color: isSender ? '#fff': '#007bff', fontWeight: 'bold'}}>
                                        Pay Now
                                    </a>
                                )}
                            </div>
                        )}
                        <span className="timestamp">
                            {formatDistanceToNowStrict(timestamp, { addSuffix: true })}
                            {isSender && getMessageStatusText(msg)}
                        
                        </span>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;
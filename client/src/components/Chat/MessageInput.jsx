// src/components/Chat/MessageInput.jsx
import React, { useState, useRef } from 'react';
// import { FiSend, FiPaperclip, FiSmile } from 'react-icons/fi'; // Example using react-icons
import './ChatPage.css'; // Or a specific MessageInput.css

const MessageInput = ({
    newMessage,
    onNewMessageChange,
    onSendMessage,
    // onImageUpload,
    // onPdfUpload,
    // onPaymentSplit
}) => {
    // const fileInputRef = useRef(null);

    // const handleAttachmentClick = () => {
    //     fileInputRef.current.click();
    // };

    // const handleFileChange = (e) => {
    //     const file = e.target.files[0];
    //     if (file) {
    //         if (file.type.startsWith('image/')) {
    //             // onImageUpload(file);
    //         } else if (file.type === 'application/pdf') {
    //             // onPdfUpload(file);
    //         } else {
    //             alert('Unsupported file type. Please upload an image or PDF.');
    //         }
    //     }
    //     // Reset file input to allow selecting the same file again if needed
    //     if (fileInputRef.current) {
    //         fileInputRef.current.value = "";
    //     }
    // };

    return (
        <form className="message-input-container" onSubmit={onSendMessage}>
            {/* Attachment Button - Placeholder */}
            {/*
            <button type="button" onClick={handleAttachmentClick} className="attachment-btn" style={{marginRight: '8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px'}}>
                <FiPaperclip />
            </button>
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
            />
            */}

            {/* Emoji Button - Placeholder */}
            {/*
            <button type="button" className="emoji-btn" style={{marginRight: '8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px'}}>
                <FiSmile />
            </button>
            */}

            <input
                type="text"
                value={newMessage}
                onChange={onNewMessageChange} // This should be the combined typing handler from ChatPage
                placeholder="Type a message..."
                autoFocus
            />
            <button type="submit" >
                {/* <FiSend /> */}
                <img src="src/assets/send.svg" alt="sendImage" />
            </button>
        </form>
    );
};

export default MessageInput;
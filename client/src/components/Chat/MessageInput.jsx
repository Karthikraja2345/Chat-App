// src/components/Chat/MessageInput.jsx
import React from 'react'; // Removed useState and useRef from import
// import { FiSend } from 'react-icons/fi'; // Or your preferred send icon
import './MessageInput.css'; // Ensure this path is correct or remove if not used

const MessageInput = ({
    newMessage,
    onNewMessageChange,
    onSendMessage,
}) => {
    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(e);
        }
    };

    return (
        <form className="message-input-container" onSubmit={handleFormSubmit}>
            <input
                type="text"
                className="message-input-field"
                value={newMessage}
                onChange={onNewMessageChange}
                placeholder="Type a message..."
                autoFocus
            />
            <button
                type="submit"
                className="message-input-send-btn"
                disabled={!newMessage.trim()}
            >
                {/* For Vite, if send.svg is in public/assets: <img src="/assets/send.svg" ... /> */}
                {/* Or if imported: import sendIcon from '/src/assets/send.svg'; <img src={sendIcon} ... /> */}
                <img src="/src/assets/send.svg" alt="Send" style={{ width: '20px', height: '20px', display: 'block' }} />
            </button>
        </form>
    );
};

export default MessageInput;
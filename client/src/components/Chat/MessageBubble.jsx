// src/components/Chat/MessageBubble.jsx
import React from 'react';
// You might want to use react-icons for file type icons
import { FiFile, FiImage, FiFilm, FiHeadphones, FiFileText, FiDownload } from 'react-icons/fi';
import './MessageBubble.css'; // Create this CSS file

const MessageBubble = ({ message, isCurrentUser }) => {
    const { type, content, sender, timestamp, status } = message;

    // Ensure content exists and has expected properties
    const textContent = content?.text || '';
    const fileUrl = content?.fileUrl;
    const fileName = content?.fileName || 'Attachment';
    const fileSize = content?.fileSize; // in bytes

    const formatFileSizeForDisplay = (bytes) => {
        if (!bytes || bytes === 0) return '';
        const k = 1024;
        return `${parseFloat((bytes / k).toFixed(1))} KB`; // Always show KB
    };

    const renderFileIcon = () => {
        const mimeType = content?.fileType || '';
        if (type === 'image' || mimeType.startsWith('image/')) return <FiImage className="file-type-icon" />;
        if (type === 'video' || mimeType.startsWith('video/')) return <FiFilm className="file-type-icon" />;
        if (type === 'audio' || mimeType.startsWith('audio/')) return <FiHeadphones className="file-type-icon" />;
        if (type === 'pdf' || mimeType === 'application/pdf') return <FiFileText className="file-type-icon" style={{ color: '#E53935' }} />; // Red for PDF
        if (type === 'document' || mimeType.includes('word') || mimeType.includes('document')) return <FiFileText className="file-type-icon" style={{ color: '#1E88E5' }} />; // Blue for Word/Docs
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FiFileText className="file-type-icon" style={{ color: '#43A047' }} />; // Green for Excel
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <FiFileText className="file-type-icon" style={{ color: '#F4511E' }} />; // Orange for PPT
        return <FiFile className="file-type-icon" />; // Generic file
    };

    const renderContent = () => {
        switch (type) {
            case 'text':
                return <p className="message-text-content">{textContent}</p>;
            case 'image':
                return (
                    <div className="message-media-container">
                        {fileUrl && <img src={fileUrl} alt={fileName} className="message-image-content" />}
                        {textContent && <p className="message-caption">{textContent}</p>}
                    </div>
                );
            case 'video':
                return (
                    <div className="message-media-container">
                        {fileUrl && <video src={fileUrl} controls className="message-video-content" />}
                        {textContent && <p className="message-caption">{textContent}</p>}
                    </div>
                );
            case 'audio':
                return (
                    <div className="message-media-container">
                        {fileUrl && <audio src={fileUrl} controls className="message-audio-content" />}
                        {textContent && <p className="message-caption">{textContent}</p>}
                    </div>
                );
            case 'pdf':
            case 'document':
            case 'file':
                return (
                    <div className="message-file-container">
                        <div className="file-icon-wrapper">
                            {renderFileIcon()}
                        </div>
                        <div className="file-info-wrapper">
                            <span className="file-name-text">{fileName}</span>
                            <span className="file-meta-text">
                                {formatFileSizeForDisplay(fileSize)}
                                {fileUrl && (
                                    <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer" className="download-icon-link" title="Download">
                                        <FiDownload />
                                    </a>
                                )}
                            </span>
                        </div>
                        {textContent && <p className="message-caption file-caption">{textContent}</p>}
                    </div>
                );
            default:
                return <p className="message-text-content">Unsupported message type: {type}</p>;
        }
    };

    // Basic check for sender (especially for messages coming from socket before full user object might be there)
    const senderName = sender?.name || 'User';

    return (
        <div className={`message-bubble-wrapper ${isCurrentUser ? 'sent' : 'received'}`}>
            <div className="message-bubble">
                {!isCurrentUser && message.chatId?.isGroupChat && <p className="sender-name-display">{senderName}</p>}
                <div className="message-content-area">
                    {renderContent()}
                </div>
                <div className="message-meta-display">
                    <span className="timestamp-display">{new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isCurrentUser && status && (
                        <span className={`message-status-display status-${status}`}>
                            {status === 'sent' && '✓'}
                            {status === 'delivered' && '✓✓'}
                            {status === 'read' && <span style={{ color: '#53bdeb' }}>✓✓</span>}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
// src/components/Chat/MessageInput.jsx
import React, { useRef, useEffect } from 'react';
import { FiPaperclip, FiSmile } from 'react-icons/fi'; // Emoji icon can be re-enabled if needed
import sendIcon from '../../assets/send.svg'; // Ensure this path is correct
// Assuming MessageInput.css is not used if ChatPage.css styles this component
import './MessageInput.css'; // Remove if styles are in ChatPage.css or a global file

const MessageInput = ({
    newMessage,
    onNewMessageChange, // This function is expected to handle typing events from ChatPage
    onSendMessage,      // This function is expected to handle the form submission from ChatPage
    onFileSelectedForPreview,
    isFileBeingProcessed, // True if a file is being uploaded or confirmed
}) => {
    const fileInputRef = useRef(null);
    const isMountedAndSettledRef = useRef(false);

    // Effect to mark component as settled after initial mount to avoid spurious file change events
    useEffect(() => {
        const timer = setTimeout(() => {
            isMountedAndSettledRef.current = true;
            // console.log("MessageInput: Component considered fully mounted and settled.");
        }, 150); // Small delay for safety

        return () => {
            clearTimeout(timer);
            isMountedAndSettledRef.current = false;
            // console.log("MessageInput: Unmounting.");
        };
    }, []); // Empty dependency array ensures this runs once on mount and cleanup on unmount

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim() && !isFileBeingProcessed) { // Also check isFileBeingProcessed here
            onSendMessage(e); // Call the passed-in submit handler
        }
    };

    const handleAttachmentClick = () => {
        // console.log("MessageInput: Attachment button clicked. isFileBeingProcessed:", isFileBeingProcessed);
        if (isFileBeingProcessed) {
            // console.log("MessageInput: Attachment click prevented, a file is already being processed.");
            return;
        }
        if (fileInputRef.current) {
            // console.log("MessageInput: Programmatically clicking file input.");
            fileInputRef.current.click();
        } else {
            console.error("MessageInput: fileInputRef.current is null, cannot click.");
        }
    };

    const handleFileChange = (e) => {
        // console.log("MessageInput: handleFileChange TRIGGERED. Event isTrusted:", e.isTrusted, "isMountedAndSettledRef.current:", isMountedAndSettledRef.current);
        // console.log("MessageInput: e.target.files:", e.target.files);

        const file = e.target.files && e.target.files[0];

        if (file) {
            // console.log("MessageInput: File is present in event - Name:", file.name, "Type:", file.type);

            // Safety check to prevent handling file changes that might fire before the component is fully ready
            // This can sometimes happen on initial load or fast re-renders with file inputs.
            if (!isMountedAndSettledRef.current && e.isTrusted) { // Only apply this strict check to trusted events
                console.warn("MessageInput: handleFileChange called BEFORE component is fully settled or was a programmatic event. Ignoring this file for safety:", file.name);
                if (fileInputRef.current) {
                    fileInputRef.current.value = ""; // Attempt to clear if a file was somehow pre-selected
                }
                return;
            }

            if (onFileSelectedForPreview) {
                // console.log("MessageInput: Calling onFileSelectedForPreview with the selected file.");
                onFileSelectedForPreview(file);
            } else {
                console.warn("MessageInput: onFileSelectedForPreview prop is not available.");
            }
        } else {
            // console.log("MessageInput: handleFileChange triggered, but no file was selected.");
        }

        // CRITICAL: Reset the file input's value.
        // This allows the user to select the same file again if they cancel the first time or want to re-upload.
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // console.log("MessageInput rendering. isFileBeingProcessed:", isFileBeingProcessed);

    return (
        <form className="message-input-container" onSubmit={handleFormSubmit}>
            <div className="input-actions">
                <button
                    type="button"
                    onClick={handleAttachmentClick}
                    className="action-button" // Ensure ChatPage.css has .action-button or use existing styles
                    aria-label="Attach file"
                    title="Attach file"
                    disabled={isFileBeingProcessed}
                >
                    <FiPaperclip />
                </button>
                {/* Emoji Picker Button - can be re-enabled */}
                {/*
                <button
                    type="button"
                    className="action-button"
                    aria-label="Open emoji picker"
                    title="Open emoji picker"
                    disabled={isFileBeingProcessed}
                >
                    <FiSmile />
                </button>
                */}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }} // Hidden, triggered programmatically
                onChange={handleFileChange}
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.zip,.rar,application/zip,application/x-rar-compressed,application/octet-stream"
                // Added 'application/octet-stream' as a general fallback for unknown file types
            />

            {/*
              The `onNewMessageChange` prop is expected to be the `handleTyping` function from ChatPage.jsx
              It updates `newMessage` state in ChatPage and handles socket typing events.
            */}
            <input // Changed to textarea for multi-line input, styled by ChatPage.css
                type="text" // Keep as text, but ChatPage.css styles it as .message-text-input
                className="message-text-input" // This class from ChatPage.css will apply textarea-like styles
                value={newMessage}
                onChange={onNewMessageChange}
                placeholder="Type a message..."
                autoFocus
                disabled={isFileBeingProcessed}
                onKeyDown={(e) => { // Optional: submit on Enter, new line on Shift+Enter
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleFormSubmit(e);
                    }
                }}
            />
            <button
                type="submit"
                className="send-button" // Ensure ChatPage.css has .send-button or use existing styles
                disabled={isFileBeingProcessed || !newMessage.trim()}
            >
                {/*
                  The path for `sendIcon` should be correct relative to this file,
                  or it should be in the `public` folder and accessed with a root path like `/send.svg`.
                  The styling for the image is now handled by ChatPage.css (.send-button img, .send-button svg)
                */}
                <img src={sendIcon} alt="Send" />
            </button>
        </form>
    );
};

export default MessageInput;
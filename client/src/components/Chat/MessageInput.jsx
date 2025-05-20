// src/components/Chat/MessageInput.jsx
import React, { useRef, useEffect, useState } from 'react';
import { FiPaperclip, FiSmile } from 'react-icons/fi';
import sendIcon from '../../assets/send.svg'; // Make sure this path is correct or use public path
import './ChatPage.css';

const MessageInput = ({
    newMessage,
    onNewMessageChange,
    onSendMessage,
    onFileSelectedForPreview,
    isFileBeingProcessed, // From ChatPage: isConfirmationDialogVisible || isActuallyUploadingOrConverting
}) => {
    const fileInputRef = useRef(null);
    const isMountedAndSettledRef = useRef(false); // To track if component has mounted and settled

    useEffect(() => {
        // console.log("MessageInput: Mounting. Initial fileInputRef.current?.files:", fileInputRef.current?.files);
        // Set ref to true after a short delay to ensure component has fully initialized
        const timer = setTimeout(() => {
            isMountedAndSettledRef.current = true;
            console.log("MessageInput: Component considered fully mounted and settled.");
        }, 150); // Small delay

        return () => {
            clearTimeout(timer);
            isMountedAndSettledRef.current = false; // Reset on unmount
            // console.log("MessageInput: Unmounting.");
        };
    }, []); // Empty dependency array ensures this runs once on mount and cleanup on unmount

    const handleAttachmentClick = () => {
        console.log("MessageInput: Attachment button clicked. isFileBeingProcessed:", isFileBeingProcessed);
        if (isFileBeingProcessed) {
            console.log("MessageInput: Attachment click prevented, a file is already being processed.");
            return;
        }
        if (fileInputRef.current) {
            console.log("MessageInput: Programmatically clicking file input.");
            fileInputRef.current.click();
        } else {
            console.error("MessageInput: fileInputRef.current is null, cannot click.");
        }
    };

    const handleFileChange = (e) => {
        console.log("MessageInput: handleFileChange TRIGGERED. Event isTrusted:", e.isTrusted, "isMountedAndSettledRef.current:", isMountedAndSettledRef.current);
        console.log("MessageInput: e.target.files:", e.target.files);

        const file = e.target.files && e.target.files[0];

        if (file) {
            console.log("MessageInput: File is present in event - Name:", file.name, "Type:", file.type);

            if (!isMountedAndSettledRef.current) {
                console.warn("MessageInput: handleFileChange called BEFORE component is fully settled. Ignoring this event for safety. File:", file.name);
                if (fileInputRef.current) {
                    fileInputRef.current.value = ""; // Attempt to clear if a file was somehow pre-selected
                }
                return; // Exit early to prevent dialog from opening on initial spurious events
            }

            if (onFileSelectedForPreview) {
                console.log("MessageInput: Calling onFileSelectedForPreview with the selected file.");
                onFileSelectedForPreview(file);
            } else {
                console.warn("MessageInput: onFileSelectedForPreview prop is not available.");
            }
        } else {
            console.log("MessageInput: handleFileChange triggered, but no file was selected (e.g., user cancelled OS dialog or event was ignored).");
        }

        // Reset the file input's value. Essential for allowing re-selection of the same file.
        // This should not re-trigger onChange by itself.
        if (fileInputRef.current) {
            // console.log("MessageInput: Resetting file input value.");
            fileInputRef.current.value = "";
        }
    };

    // console.log("MessageInput rendering. isFileBeingProcessed:", isFileBeingProcessed);

    return (
        <form className="message-input-container" onSubmit={onSendMessage}>
            <div className="input-actions">
                <button
                    type="button"
                    onClick={handleAttachmentClick}
                    className="action-button"
                    aria-label="Attach file"
                    title="Attach file"
                    disabled={isFileBeingProcessed}
                >
                    <FiPaperclip />
                </button>
                {/* <button
                    type="button"
                    className="action-button"
                    aria-label="Open emoji picker"
                    title="Open emoji picker"
                    disabled={isFileBeingProcessed}
                >
                    <FiSmile />
                </button> */}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,.zip,.rar,application/zip,application/x-rar-compressed"
            />

            <input
                type="text"
                className="message-text-input"
                value={newMessage}
                onChange={onNewMessageChange}
                placeholder="Type a message..."
                autoFocus
                disabled={isFileBeingProcessed}
            />
            <button
                type="submit"
                className="send-button"
                disabled={isFileBeingProcessed || !newMessage.trim()}
            >
                <img src={sendIcon} alt="Send" />
            </button>
        </form>
    );
};

export default MessageInput;
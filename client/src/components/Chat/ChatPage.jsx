// client/src/components/Chat/ChatPage.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import UserList from './UserList';
import ChatWindow from './ChatWindow';
import CreateGroupModal from '../Group/CreateGroupModal'; // For group creation
import FileUploadConfirmationDialog from './FileUploadConfirmationDialog'; // For file uploads
import { fetchUserChatsAPI, accessOrCreateChatAPI, getMessagesAPI } from '../../services/api';
import './ChatPage.css';

// Using VITE_SOCKET_URL for flexibility, fallback to localhost
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';
// Endpoint for file uploads, ensure this matches your backend configuration
const YOUR_ACTUAL_BACKEND_UPLOAD_ENDPOINT = import.meta.env.VITE_UPLOAD_URL || 'http://localhost:5001/api/files/upload';

// API helper for file uploads
const uploadFileToBackendAPI = async (file, chatId /*, token */) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', chatId); // Include chatId if your backend needs it for context
    try {
        const fetchOptions = {
            method: 'POST',
            body: formData,
            // Example for including auth token if needed:
            // headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        };
        const response = await fetch(YOUR_ACTUAL_BACKEND_UPLOAD_ENDPOINT, fetchOptions);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Server error: ${response.status}` }));
            throw new Error(errorData.message || `File upload failed: ${response.statusText}`);
        }
        const result = await response.json();
        return {
            url: result.fileUrl || result.url, // Adjust based on your backend response
            name: result.fileName || result.name || file.name,
            type: result.fileType || result.type || file.type,
            size: result.fileSize || result.size || file.size,
        };
    } catch (error) {
        console.error('Error during file upload API call:', error);
        throw error;
    }
};

const ChatPage = () => {
    const { user, logout, isAuthenticated } = useAuth();

    // States for chat core functionality
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [typingUsers, setTypingUsers] = useState({});

    // State for group creation modal
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

    // States for file upload dialog
    const [fileForConfirmation, setFileForConfirmation] = useState(null);
    const [isConfirmationDialogVisible, setIsConfirmationDialogVisible] = useState(false);
    const [isActuallyUploadingOrConverting, setIsActuallyUploadingOrConverting] = useState(false);

    // Refs
    const socketRef = useRef(null);
    const selectedChatRef = useRef(null); // To access selectedChat in socket handlers without stale closures
    const typingTimeoutRef = useRef(null); // For typing indicator timeout

    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);

    const emitMessageReadIfNeeded = useCallback((msg, currentChatId, currentUserId) => {
        if (socketRef.current && msg.sender && currentUserId && msg.sender._id !== currentUserId &&
            (!msg.readBy || !msg.readBy.map(u => u.toString()).includes(currentUserId.toString()))) {
            socketRef.current.emit('messageRead', { messageId: msg._id, chatId: currentChatId, userId: currentUserId });
        }
    }, []); // socketRef.current is mutable, no need to list as dep

    const loadUserChats = useCallback(async () => {
        if (isAuthenticated && user?._id) {
            try {
                const response = await fetchUserChatsAPI();
                setChats(Array.isArray(response.data) ? response.data.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)) : []);
            } catch (error) {
                console.error("Failed to fetch chats:", error);
                setChats([]);
            }
        } else {
            setChats([]);
            setSelectedChat(null);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        loadUserChats();
    }, [loadUserChats]);

    // Socket Connection and Event Handlers
    useEffect(() => {
        if (!isAuthenticated || !user?._id) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        if (!socketRef.current) {
            socketRef.current = io(SOCKET_SERVER_URL);

            socketRef.current.on('connect', () => {
                console.log('Socket connected');
                socketRef.current.emit('userOnline', user._id);
            });

            socketRef.current.on('receiveMessage', (incomingMessage) => {
                if (selectedChatRef.current && incomingMessage.chatId === selectedChatRef.current._id) {
                    setMessages((prev) => [...prev, incomingMessage]);
                    if (user?._id && !incomingMessage.isSystemMessage) {
                        emitMessageReadIfNeeded(incomingMessage, selectedChatRef.current._id, user._id);
                    }
                }
                // Update chats list. If new message for an existing chat, update it and move to top.
                // If it's a new chat the user is part of, reload all chats.
                setChats(prevChats => {
                    const chatIndex = prevChats.findIndex(c => c._id === incomingMessage.chatId);
                    if (chatIndex > -1) {
                        const updatedChat = { ...prevChats[chatIndex], lastMessage: incomingMessage, updatedAt: incomingMessage.timestamp || new Date().toISOString() };
                        const newChats = prevChats.filter(c => c._id !== incomingMessage.chatId);
                        return [updatedChat, ...newChats].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    } else if (incomingMessage.isSystemMessage || (user?._id && incomingMessage.participants?.some(p => p._id === user._id))) {
                        loadUserChats(); // Reload all chats to correctly fetch the new chat
                    }
                    return prevChats; // Return previous chats if no specific update or reload condition is met
                });
            });

            socketRef.current.on('messageStatusUpdate', ({ messageId, status, readBy }) => {
                setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, status, readBy } : msg));
            });

            socketRef.current.on('userTyping', ({ chatId, userName }) => {
                if (selectedChatRef.current && chatId === selectedChatRef.current._id) {
                    setTypingUsers(prev => ({ ...prev, [chatId]: `${userName} is typing...` }));
                }
            });

            socketRef.current.on('userStopTyping', ({ chatId }) => {
                if (selectedChatRef.current && chatId === selectedChatRef.current._id) {
                    setTypingUsers(prev => { const newState = { ...prev }; delete newState[chatId]; return newState; });
                }
            });

            socketRef.current.on('disconnect', () => console.log('Socket disconnected'));
            socketRef.current.on('connect_error', (error) => console.error('Socket Connection error:', error));
        }

        return () => {
            if (socketRef.current) {
                // Optional: emit userOffline event if your backend handles it
                // socketRef.current.emit('userOffline', user._id);
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [user, isAuthenticated, emitMessageReadIfNeeded, loadUserChats]);

    // Load Messages for Selected Chat
    useEffect(() => {
        if (selectedChat?._id && user?._id) {
            const loadMessagesForChat = async () => {
                setLoadingMessages(true);
                setMessages([]);
                try {
                    const response = await getMessagesAPI(selectedChat._id);
                    if (Array.isArray(response.data)) {
                        setMessages(response.data);
                        if (socketRef.current) {
                            socketRef.current.emit('joinChat', selectedChat._id);
                            response.data.forEach(msg => {
                                if (!msg.isSystemMessage) emitMessageReadIfNeeded(msg, selectedChat._id, user._id);
                            });
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch messages:", error);
                    setMessages([]);
                } finally {
                    setLoadingMessages(false);
                }
            };
            loadMessagesForChat();
            const chatToLeave = selectedChat._id;
            return () => {
                if (socketRef.current && chatToLeave) {
                    socketRef.current.emit('leaveChat', chatToLeave);
                }
                // Clear typing indicator for the chat being left
                setTypingUsers(prev => { const newState = { ...prev }; delete newState[chatToLeave]; return newState; });
            };
        } else {
            setMessages([]); // Clear messages if no chat is selected
        }
    }, [selectedChat, user?._id, emitMessageReadIfNeeded]);

    // Helper to determine message type for file uploads
    const determineFileTypeForMessage = (mimeType) => {
        if (!mimeType) return 'file';
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'pdf';
        if (mimeType.includes('document') || mimeType.includes('msword') || mimeType.includes('excel') || mimeType.includes('powerpoint') || mimeType.includes('text')) return 'document';
        return 'file';
    };

    // Callback to cancel file upload/conversion
    const handleCancelFileUpload = useCallback(() => {
        setFileForConfirmation(null);
        setIsConfirmationDialogVisible(false);
        setIsActuallyUploadingOrConverting(false);
    }, []);

    // Handle Chat Selection (either by selecting existing chat or creating/accessing one with a user ID)
    const handleSelectChat = useCallback(async (chatOrUserId) => {
        if (selectedChatRef.current?._id === (typeof chatOrUserId === 'string' ? null : chatOrUserId?._id)) {
            return; // Avoid re-selecting the same chat
        }

        // If file confirmation dialog is open, cancel it when switching chats
        if (isConfirmationDialogVisible) {
            handleCancelFileUpload();
        }

        setMessages([]); // Clear previous messages
        setTypingUsers({}); // Clear typing indicators

        if (typeof chatOrUserId === 'string') { // User ID passed, access or create chat
            setSelectedChat(null); // Clear current selection immediately
            setLoadingMessages(true);
            try {
                const { data: newOrExistingChat } = await accessOrCreateChatAPI(chatOrUserId);
                if (newOrExistingChat?._id) {
                    setSelectedChat(newOrExistingChat);
                    // Update chats list: add new chat or move existing to top, then sort
                    setChats(prev => {
                        const filteredChats = prev.filter(c => c._id !== newOrExistingChat._id);
                        return [newOrExistingChat, ...filteredChats].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    });
                }
            } catch (error) {
                console.error("Access/create chat error:", error);
                setSelectedChat(null); // Ensure selected chat is cleared on error
            } finally {
                setLoadingMessages(false); // This will be true until messages are loaded by the other effect
            }
        } else if (chatOrUserId?._id) { // Full chat object passed
            // setLoadingMessages(true); // Message loading effect will handle its own loading state
            setSelectedChat(chatOrUserId);
            // Move selected chat to top of the list
            setChats(prev => {
                const filteredChats = prev.filter(c => c._id !== chatOrUserId._id);
                return [chatOrUserId, ...filteredChats].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
            });
        } else {
            setSelectedChat(null); // No valid chat selected
        }
    }, [isConfirmationDialogVisible, handleCancelFileUpload]);

    // Handle Sending a Text Message
    const handleSendMessage = useCallback((e) => {
        e.preventDefault();
        if (newMessage.trim() && selectedChatRef.current?._id && user?._id && socketRef.current) {
            socketRef.current.emit('sendMessage', {
                chatId: selectedChatRef.current._id,
                senderId: user._id,
                content: { text: newMessage.trim() },
                type: 'text'
            });
            setNewMessage('');
            if (selectedChatRef.current?._id) { // Ensure chat is still selected
                socketRef.current.emit('stopTyping', { chatId: selectedChatRef.current._id });
            }
        }
    }, [newMessage, user?._id]);

    // Handle User Typing
    const handleTyping = useCallback((e) => {
        setNewMessage(e.target.value);
        if (!socketRef.current || !selectedChatRef.current?._id || !user?.name) return;

        socketRef.current.emit('typing', { chatId: selectedChatRef.current._id, userName: user.name });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current && selectedChatRef.current?._id) {
                socketRef.current.emit('stopTyping', { chatId: selectedChatRef.current._id });
            }
        }, 2000);
    }, [user?.name]);

    // Handle Group Creation
    const handleGroupCreated = useCallback((newGroupChatData) => {
        if (newGroupChatData?._id) {
            setChats(prev => [newGroupChatData, ...prev].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
            setSelectedChat(newGroupChatData); // Automatically select the new group
        }
        setShowCreateGroupModal(false);
    }, []);

    // Handle Chat Updates (e.g., name change, member add/remove, chat deletion)
    const handleChatUpdated = useCallback((updatedChatData) => {
        if (updatedChatData?.deletedChatId) { // A chat was deleted
            if (selectedChatRef.current?._id === updatedChatData.deletedChatId) {
                setSelectedChat(null); // Deselect if current chat is deleted
            }
            setChats(prev => prev.filter(c => c._id !== updatedChatData.deletedChatId));
            return;
        }

        if (updatedChatData?._id) { // A chat was updated
            const currentUserIdForCheck = user?._id;
            // Check if current user is still part of the chat (especially for group chats)
            const currentUserIsStillParticipant = currentUserIdForCheck &&
                (updatedChatData.isGroupChat ?
                    updatedChatData.participants?.some(p => p._id === currentUserIdForCheck) :
                    true); // For 1-on-1 chats, assume participant if chat exists

            // Update selectedChat if it's the one being modified
            if (selectedChatRef.current?._id === updatedChatData._id) {
                if (!currentUserIsStillParticipant && updatedChatData.isGroupChat) {
                    setSelectedChat(null); // User removed from current group chat
                } else {
                    setSelectedChat(prev => ({ ...prev, ...updatedChatData }));
                }
            }

            // Update chats list
            setChats(prevChats => {
                // If user is no longer a participant in a group chat, remove it
                if (!currentUserIsStillParticipant && updatedChatData.isGroupChat && prevChats.some(c => c._id === updatedChatData._id)) {
                    return prevChats.filter(c => c._id !== updatedChatData._id)
                                  .sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                }
                
                const idx = prevChats.findIndex(c => c._id === updatedChatData._id);
                if (idx > -1) { // Chat exists, update it
                    const newChats = [...prevChats];
                    newChats[idx] = { ...newChats[idx], ...updatedChatData };
                    return newChats.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                } else if (currentUserIsStillParticipant || !updatedChatData.isGroupChat) {
                    // Add if it's a new chat the user is part of (e.g., added to a group, or new 1-on-1)
                     return [updatedChatData, ...prevChats].sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                }
                return prevChats; // No change if chat doesn't exist and user is not part of it
            });
        }
    }, [user?._id]);

    // Handle File Selection for Preview
    const handleFileSelectedForPreview = useCallback((file) => {
        if (!selectedChatRef.current?._id || !user?._id) {
            alert('Please select a chat before attaching a file.');
            return;
        }
        setFileForConfirmation(file);
        setIsConfirmationDialogVisible(true);
    }, [user?._id]);

    // Handle Confirmation and Upload of File
    const handleConfirmAndUploadFile = useCallback(async (fileToShareDetails, caption) => {
        if (!fileToShareDetails || !selectedChatRef.current?._id || !user?._id) {
            console.warn('File, selected chat, or user missing for upload confirmation.');
            alert('Cannot share file. Please ensure a chat is active and you are logged in.');
            handleCancelFileUpload(); // Use the memoized version
            return;
        }

        setIsActuallyUploadingOrConverting(true);

        let finalFileUrl, finalFileName, finalFileType, finalFileSize;
        finalFileName = fileToShareDetails.name;
        finalFileType = fileToShareDetails.type;
        finalFileSize = fileToShareDetails.size;

        try {
            // If file is already converted/hosted (e.g. from a picker that returns a URL)
            if (fileToShareDetails.isConverted && fileToShareDetails.uploadableUrl) {
                finalFileUrl = fileToShareDetails.uploadableUrl;
            } else if (fileToShareDetails instanceof File) { // If it's a raw File object, upload it
                const uploadedData = await uploadFileToBackendAPI(fileToShareDetails, selectedChatRef.current._id);
                finalFileUrl = uploadedData.url;
                finalFileName = uploadedData.name || finalFileName;
                finalFileType = uploadedData.type || finalFileType;
                finalFileSize = uploadedData.size || finalFileSize;
            } else {
                throw new Error("Invalid file data received for sharing.");
            }

            const messageType = determineFileTypeForMessage(finalFileType);
            const fileMessageData = {
                chatId: selectedChatRef.current._id,
                senderId: user._id,
                type: messageType,
                content: {
                    text: caption || '', // Optional caption
                    fileUrl: finalFileUrl,
                    fileName: finalFileName,
                    fileType: finalFileType,
                    fileSize: finalFileSize,
                },
            };

            if (socketRef.current) {
                socketRef.current.emit('sendMessage', fileMessageData);
            }
        } catch (error) {
            console.error('Error during file processing or sending message:', error);
            alert(`Failed to share file: ${error.message || 'An unknown error occurred.'}`);
        } finally {
            handleCancelFileUpload(); // Use the memoized version
        }
    }, [user?._id, handleCancelFileUpload]); // Dependencies

    // Render loading/auth states
    if (!isAuthenticated) return <div className="chat-page-container"><div className="no-chat-selected"><p>Please log in.</p></div></div>;
    if (!user) return <div className="chat-page-container"><div className="no-chat-selected"><p>Loading user...</p></div></div>;

    // Flag to indicate if any file processing is ongoing (for ChatWindow prop)
    const isProcessingFile = isConfirmationDialogVisible || isActuallyUploadingOrConverting;

    return (
        <div className="chat-page-container">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h3>Chats</h3>
                    <div className="sidebar-header-actions">
                        <button onClick={() => setShowCreateGroupModal(true)} className="sidebar-action-btn">New Group</button>
                        <button onClick={logout} className="sidebar-action-btn">Logout</button>
                    </div>
                </div>
                <UserList
                    chats={chats}
                    onSelectChat={handleSelectChat}
                    currentUser={user}
                    selectedChatId={selectedChat?._id}
                />
            </div>
            <div className="chat-area">
                {selectedChat?._id ? (
                    <ChatWindow
                        key={selectedChat._id} // Ensures ChatWindow re-initializes if chat ID changes
                        chat={selectedChat}
                        messages={messages}
                        loadingMessages={loadingMessages}
                        currentUser={user}
                        onSendMessage={handleSendMessage}
                        newMessage={newMessage}
                        onNewMessageChange={handleTyping}
                        typingIndicator={typingUsers[selectedChat._id]}
                        onChatUpdated={handleChatUpdated} // For group/chat metadata updates
                        onFileSelectedForPreview={handleFileSelectedForPreview} // For initiating file upload
                        isFileBeingProcessed={isProcessingFile} // To disable input during file processing
                        isActuallyUploading={isActuallyUploadingOrConverting} // For specific UI feedback during upload
                    />
                ) : (
                    <div className="no-chat-selected">
                        <p>Select a chat or start a new conversation.</p>
                    </div>
                )}
            </div>
            {showCreateGroupModal && user && (
                <CreateGroupModal
                    currentUser={user}
                    onClose={() => setShowCreateGroupModal(false)}
                    onGroupCreated={handleGroupCreated}
                />
            )}
            <FileUploadConfirmationDialog
                isOpen={isConfirmationDialogVisible}
                file={fileForConfirmation}
                onConfirm={handleConfirmAndUploadFile}
                onCancel={handleCancelFileUpload}
                isActuallyUploading={isActuallyUploadingOrConverting}
            />
        </div>
    );
};

export default ChatPage;
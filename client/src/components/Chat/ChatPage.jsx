// client/src/components/Chat/ChatPage.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import UserList from './UserList';
import ChatWindow from './ChatWindow';

import FileUploadConfirmationDialog from './FileUploadConfirmationDialog';
import CreateGroupModal from '../Group/CreateGroupModal';
import { fetchUserChatsAPI, accessOrCreateChatAPI, getMessagesAPI } from '../../services/api';
import './ChatPage.css';

const SOCKET_SERVER_URL = 'http://localhost:5001';
const YOUR_ACTUAL_BACKEND_UPLOAD_ENDPOINT = 'http://localhost:5001/api/files/upload';

const uploadFileToBackendAPI = async (file, chatId /*, token */) => {
    // console.log(`Attempting to upload file: ${file.name} for chat: ${chatId}`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', chatId);
    try {
        const fetchOptions = { method: 'POST', body: formData, /* headers: token ? { 'Authorization': `Bearer ${token}` } : {} */ };
        const response = await fetch(YOUR_ACTUAL_BACKEND_UPLOAD_ENDPOINT, fetchOptions);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Server error: ${response.status}` }));
            throw new Error(errorData.message || `File upload failed: ${response.statusText}`);
        }
        const result = await response.json();
        return {
            url: result.fileUrl || result.url,
            name: result.fileName || result.name || file.name,
            type: result.fileType || result.type || file.type,
            size: result.fileSize || result.size || file.size,
        };
    } catch (error) {
        console.error('Error during file upload API call:', error);
        throw error;
    }


const ChatPage = () => {
    const { user, logout, isAuthenticated } = useAuth(); // user object from context
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const socketRef = useRef(null);
    const [typingUsers, setTypingUsers] = useState({});


    // --- INITIAL STATES FOR DIALOG ---
    const [fileForConfirmation, setFileForConfirmation] = useState(null);             // Should be null initially
    const [isConfirmationDialogVisible, setIsConfirmationDialogVisible] = useState(false); // CRITICAL: Should be false initially
    const [isActuallyUploadingOrConverting, setIsActuallyUploadingOrConverting] = useState(false);
    // --- END INITIAL STATES ---

    const selectedChatRef = useRef(null);
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

    const emitMessageReadIfNeeded = (msg, currentChatId, currentUserId) => {
        if (socketRef.current && msg.sender && msg.sender._id !== currentUserId &&
            currentUserId &&
            (!msg.readBy || !msg.readBy.map(u => u.toString()).includes(currentUserId.toString()))) {
            socketRef.current.emit('messageRead', {
                messageId: msg._id, chatId: currentChatId, userId: currentUserId
            });

    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const selectedChatRef = useRef(null);

    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);

    const emitMessageReadIfNeeded = useCallback((msg, currentChatId, currentUserId) => {
        if (socketRef.current && msg.sender && currentUserId && msg.sender._id !== currentUserId &&
            (!msg.readBy || !msg.readBy.map(u => u.toString()).includes(currentUserId.toString()))) {
            socketRef.current.emit('messageRead', { messageId: msg._id, chatId: currentChatId, userId: currentUserId });

        }
    }, []); // Empty deps: socketRef.current is mutable, not a dependency for useCallback


    useEffect(() => {
        if (!isAuthenticated || !user?._id) {
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
            return;
        }
        if (!socketRef.current) {
            socketRef.current = io(SOCKET_SERVER_URL);
            socketRef.current.on('connect', () => socketRef.current.emit('userOnline', user._id));
            socketRef.current.on('receiveMessage', (incomingMessage) => {
                if (selectedChatRef.current && incomingMessage.chatId === selectedChatRef.current._id) {
                    setMessages((prev) => [...prev, incomingMessage]);
                    if (user?._id) emitMessageReadIfNeeded(incomingMessage, selectedChatRef.current._id, user._id);
                } else {
                    setChats(prevChats => {
                        let chatExists = false;
                        const updated = prevChats.map(c => {
                            if (c._id === incomingMessage.chatId) {
                                chatExists = true;
                                return { ...c, lastMessage: incomingMessage, updatedAt: incomingMessage.timestamp || new Date().toISOString() };
                            }
                            return c;
                        });
                        if (!chatExists) loadUserChats();
                        return updated.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    });
                }
            });
            socketRef.current.on('messageStatusUpdate', (data) => {
                setMessages(prev => prev.map(msg => msg._id === data.messageId ? { ...msg, status: data.status, readBy: data.readBy } : msg ));
            });
            socketRef.current.on('userTyping', ({ chatId: typingChatId, userName }) => {
                if (selectedChatRef.current && typingChatId === selectedChatRef.current._id) {
                    setTypingUsers(prev => ({ ...prev, [typingChatId]: `${userName} is typing...` }));
                }
            });
            socketRef.current.on('userStopTyping', ({ chatId: typingChatId }) => {
                 if (selectedChatRef.current && typingChatId === selectedChatRef.current._id) {
                    setTypingUsers(prev => { const newState = { ...prev }; delete newState[typingChatId]; return newState; });

    const loadUserChats = useCallback(async () => {
        if (isAuthenticated && user?._id) { // Depends on user object
            try {
                const response = await fetchUserChatsAPI();
                setChats(Array.isArray(response.data) ? response.data.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)) : []);
            } catch (error) { console.error("Failed to fetch chats:", error); setChats([]); }
        } else { setChats([]); setSelectedChat(null); }
    }, [isAuthenticated, user]); // user from useAuth should be stable or its relevant parts (user._id)

    useEffect(() => { loadUserChats(); }, [loadUserChats]);

    useEffect(() => { // Socket Effect
        if (!isAuthenticated || !user?._id) {
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } return;
        }
        if (!socketRef.current) {
            socketRef.current = io(SOCKET_SERVER_URL);
            socketRef.current.on('connect', () => { console.log('Socket connected'); socketRef.current.emit('userOnline', user._id); });
            socketRef.current.on('receiveMessage', (incomingMessage) => {
                if (selectedChatRef.current && incomingMessage.chatId === selectedChatRef.current._id) {
                    setMessages((prev) => [...prev, incomingMessage]);
                    if (user?._id && !incomingMessage.isSystemMessage) {
                        emitMessageReadIfNeeded(incomingMessage, selectedChatRef.current._id, user._id);
                    }

                }
                setChats(prevChats => {
                    const chatIndex = prevChats.findIndex(c => c._id === incomingMessage.chatId);
                    if (chatIndex > -1) {
                        const updatedChat = { ...prevChats[chatIndex], lastMessage: incomingMessage, updatedAt: incomingMessage.timestamp || new Date().toISOString() };
                        const newChats = prevChats.filter(c => c._id !== incomingMessage.chatId);
                        return [updatedChat, ...newChats].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    } else if (incomingMessage.isSystemMessage || (user?._id && incomingMessage.participants?.some(p => p._id === user._id))) {
                        loadUserChats(); // Reload all if new chat user is part of
                    }
                    return prevChats;
                });
            });

        }
        return () => { if (socketRef.current && user?._id) { socketRef.current.disconnect(); socketRef.current = null; } };
    }, [user, isAuthenticated]);

    const loadUserChats = async () => {
        if (isAuthenticated && user?._id) {
            try {
                const res = await fetchUserChatsAPI();
                if (Array.isArray(res.data)) setChats(res.data.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
                else setChats([]);
            } catch (err) { console.error("Fetch chats error:", err); setChats([]); }
        } else setChats([]);
    };
    useEffect(() => { loadUserChats(); }, [user, isAuthenticated]);

    useEffect(() => {
        if (selectedChat?._id && user?._id) {
            const loadMsgs = async () => {
                setLoadingMessages(true); setMessages([]);
                try {
                    const res = await getMessagesAPI(selectedChat._id);
                    if (Array.isArray(res.data)) {
                        setMessages(res.data);
                        if (socketRef.current) {
                            socketRef.current.emit('joinChat', selectedChat._id);
                            res.data.forEach(msg => emitMessageReadIfNeeded(msg, selectedChat._id, user._id));
                        }
                    } else setMessages([]);
                } catch (err) { console.error("Fetch messages error:", err); setMessages([]); }
                finally { setLoadingMessages(false); }
            };
            loadMsgs();
            const chatToLeave = selectedChat._id;
            return () => { if (socketRef.current && chatToLeave) socketRef.current.emit('leaveChat', chatToLeave); };
        } else setMessages([]);
    }, [selectedChat, user]);

    const handleSelectChat = async (chatOrUserId) => {
        if (selectedChatRef.current?._id === (typeof chatOrUserId === 'string' ? null : chatOrUserId?._id)) return;
        setMessages([]); setTypingUsers({}); setSelectedChat(null);
        // Close confirmation dialog if open when switching chats
        if (isConfirmationDialogVisible) {
            handleCancelFileUpload();
        }
        if (typeof chatOrUserId === 'string') {
            try {
                const res = await accessOrCreateChatAPI(chatOrUserId);
                if (res.data?._id) {
                    setSelectedChat(res.data);
                    setChats(prev => {
                        const idx = prev.findIndex(c => c._id === res.data._id);
                        if (idx > -1) { const temp = [...prev]; const E = temp.splice(idx,1)[0]; return [Object.assign(E,res.data), ...temp];}
                        else return [res.data, ...prev].sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    });
                } else setSelectedChat(null);
            } catch (err) { console.error("Access/create chat error:", err); setSelectedChat(null); }
        } else {
            if (chatOrUserId?._id) setSelectedChat(chatOrUserId); else setSelectedChat(null);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && selectedChatRef.current?._id && user?._id) {
            const msgData = { chatId: selectedChatRef.current._id, senderId: user._id, content: { text: newMessage.trim() }, type: 'text'};
            if (socketRef.current) socketRef.current.emit('sendMessage', msgData);
            setNewMessage('');
            if (socketRef.current) socketRef.current.emit('stopTyping', { chatId: selectedChatRef.current._id });
]
            socketRef.current.on('messageStatusUpdate', ({ messageId, status, readBy }) => setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, status, readBy } : msg)));
            socketRef.current.on('userTyping', ({ chatId, userName }) => selectedChatRef.current && chatId === selectedChatRef.current._id && setTypingUsers(prev => ({ ...prev, [chatId]: `${userName} is typing...` })));
            socketRef.current.on('userStopTyping', ({ chatId }) => selectedChatRef.current && chatId === selectedChatRef.current._id && setTypingUsers(prev => { const n = {...prev}; delete n[chatId]; return n;}));
            socketRef.current.on('disconnect', () => console.log('Socket disconnected'));
            socketRef.current.on('connect_error', (error) => console.error('Socket Connection error:', error));
        }
        return () => { if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }};
    }, [user, isAuthenticated, emitMessageReadIfNeeded, loadUserChats]); // user dependency is important here

    useEffect(() => { // Load Messages Effect
        if (selectedChat?._id && user?._id) {
            const loadMessagesForChat = async () => {
                setLoadingMessages(true); setMessages([]);
                try {
                    const response = await getMessagesAPI(selectedChat._id);
                    if (Array.isArray(response.data)) {
                        setMessages(response.data);
                        if (socketRef.current) {
                            socketRef.current.emit('joinChat', selectedChat._id);
                            response.data.forEach(msg => { if (!msg.isSystemMessage) emitMessageReadIfNeeded(msg, selectedChat._id, user._id); });
                        }
                    }
                } catch (error) { console.error("Failed to fetch messages:", error); setMessages([]); }
                finally { setLoadingMessages(false); }
            };
            loadMessagesForChat();
            const chatToLeave = selectedChat._id;
            return () => { if (socketRef.current && chatToLeave) socketRef.current.emit('leaveChat', chatToLeave); setTypingUsers(prev => { const n = {...prev}; delete n[chatToLeave]; return n;}) };
        } else { setMessages([]); }
    }, [selectedChat, user?._id, emitMessageReadIfNeeded]);

    const handleSelectChat = useCallback(async (chatOrUserId) => {
        if (selectedChatRef.current?._id === (typeof chatOrUserId === 'string' ? null : chatOrUserId?._id)) return;
        setMessages([]); setTypingUsers({});
        if (typeof chatOrUserId === 'string') {
            setLoadingMessages(true); setSelectedChat(null);
            try {
                const { data: newOrExistingChat } = await accessOrCreateChatAPI(chatOrUserId);
                if (newOrExistingChat?._id) {
                    setSelectedChat(newOrExistingChat);
                    setChats(prev => { /* ... update logic ... */ return [newOrExistingChat, ...prev.filter(c=>c._id !== newOrExistingChat._id)].sort((a,b)=>new Date(b.updatedAt || 0)-new Date(a.updatedAt||0)); });
                }
            } catch (error) { console.error("Access/create chat error:", error); setSelectedChat(null); }
            finally { setLoadingMessages(false); }
        } else if (chatOrUserId?._id) {
            setSelectedChat(chatOrUserId);
            setChats(prev => [chatOrUserId, ...prev.filter(c => c._id !== chatOrUserId._id)]);
        } else { setSelectedChat(null); }
    }, []); // Empty deps if API calls are stable and state setters are used

    const handleSendMessage = useCallback((e) => {
        e.preventDefault();
        if (newMessage.trim() && selectedChatRef.current?._id && user?._id && socketRef.current) {
            socketRef.current.emit('sendMessage', { chatId: selectedChatRef.current._id, senderId: user._id, content: { text: newMessage.trim() }, type: 'text' });
            setNewMessage('');
            if (selectedChatRef.current._id) socketRef.current.emit('stopTyping', { chatId: selectedChatRef.current._id });

        }
    }, [newMessage, user?._id]); // Depends on newMessage and user._id

    const determineFileTypeForMessage = (mimeType) => {
        if (!mimeType) return 'file';
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'pdf';
        if (mimeType.includes('document') || mimeType.includes('msword') || mimeType.includes('excel') || mimeType.includes('powerpoint') || mimeType.includes('text')) return 'document';
        return 'file';
    };

    const typingTimeoutRef = useRef(null);
    const handleTyping = useCallback((e) => {
        setNewMessage(e.target.value);
        if (!socketRef.current || !selectedChatRef.current?._id || !user?.name) return;
        socketRef.current.emit('typing', { chatId: selectedChatRef.current._id, userName: user.name });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current && selectedChatRef.current?._id) socketRef.current.emit('stopTyping', { chatId: selectedChatRef.current._id });
        }, 2000);
    }, [user?.name]); // Depends on user.name


    const handleFileSelectedForPreview = (file) => {
        if (!selectedChatRef.current?._id || !user?._id) {
            alert('Please select a chat before attaching a file.');
            return;
        }
        setFileForConfirmation(file);
        setIsConfirmationDialogVisible(true);
    };

    const handleCancelFileUpload = () => {
        setFileForConfirmation(null);
        setIsConfirmationDialogVisible(false);
        setIsActuallyUploadingOrConverting(false);
    };

    const handleConfirmAndUploadFile = async (fileToShareDetails, caption) => {
        if (!fileToShareDetails || !selectedChatRef.current?._id || !user?._id) {
            console.warn('File, selected chat, or user missing for upload confirmation.');
            alert('Cannot share file. Please ensure a chat is active and you are logged in.');
            handleCancelFileUpload();
            return;
        }

        setIsActuallyUploadingOrConverting(true);

        let finalFileUrl;
        let finalFileName = fileToShareDetails.name;
        let finalFileType = fileToShareDetails.type;
        let finalFileSize = fileToShareDetails.size;

        try {
            if (fileToShareDetails.isConverted && fileToShareDetails.uploadableUrl) {
                // console.log("Sharing a pre-converted file from URL:", fileToShareDetails.uploadableUrl);
                finalFileUrl = fileToShareDetails.uploadableUrl;
            } else if (fileToShareDetails instanceof File) {
                // console.log("Uploading original file:", fileToShareDetails.name);
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
                    text: caption || '',
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
            handleCancelFileUpload();
        }
    };


    if (!isAuthenticated) {
        return <div className="chat-page-container"><div className="no-chat-selected"><p>Please log in to access your chats.</p></div></div>;
    }

    const handleGroupCreated = useCallback((newGroupChatData) => {
        if (newGroupChatData?._id) {
            setChats(prev => [newGroupChatData, ...prev].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
            setSelectedChat(newGroupChatData);
        }
        setShowCreateGroupModal(false);
    }, []); // setChats, setSelectedChat, setShowCreateGroupModal are stable

    const handleChatUpdated = useCallback((updatedChatData) => {
        // console.log("[ChatPage] handleChatUpdated received:", JSON.stringify(updatedChatData, null, 2));
        if (updatedChatData?.deletedChatId) {
            if (selectedChatRef.current?._id === updatedChatData.deletedChatId) setSelectedChat(null);
            setChats(prev => prev.filter(c => c._id !== updatedChatData.deletedChatId)); return;
        }
        if (updatedChatData?._id) {
            const currentUserIdForCheck = user?._id; // Capture stable value
            const currentUserIsStillParticipant = currentUserIdForCheck && (updatedChatData.isGroupChat ? updatedChatData.participants?.some(p => p._id === currentUserIdForCheck) : true);
            
            if (selectedChatRef.current?._id === updatedChatData._id) {
                if (!currentUserIsStillParticipant && updatedChatData.isGroupChat) {
                    setSelectedChat(null);
                } else {
                    setSelectedChat(prev => ({ ...prev, ...updatedChatData }));
                }
            }
            setChats(prev => {
                if (!currentUserIsStillParticipant && updatedChatData.isGroupChat && prev.some(c => c._id === updatedChatData._id)) {
                    return prev.filter(c => c._id !== updatedChatData._id).sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                }
                const idx = prev.findIndex(c => c._id === updatedChatData._id);
                if (idx > -1) {
                    const newChats = [...prev]; newChats[idx] = { ...newChats[idx], ...updatedChatData };
                    return newChats.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                }
                if (currentUserIsStillParticipant || !updatedChatData.isGroupChat) {
                     return [updatedChatData, ...prev].sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                }
                return prev;
            });
        }
    }, [user?._id]); // Depends on user._id for participation check

    if (!isAuthenticated) return <div className="chat-page-container"><div className="no-chat-selected"><p>Please log in.</p></div></div>;
    if (!user) return <div className="chat-page-container"><div className="no-chat-selected"><p>Loading user...</p></div></div>;


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
                <UserList chats={chats} onSelectChat={handleSelectChat} currentUser={user} selectedChatId={selectedChat?._id} />
            </div>
            <div className="chat-area">

                {selectedChat && selectedChat._id ? (
                    <ChatWindow

                {selectedChat?._id ? (
                    <ChatWindow
                        key={selectedChat._id}
                        chat={selectedChat}
                        messages={messages}
                        loadingMessages={loadingMessages}
                        currentUser={user}
                        onSendMessage={handleSendMessage}
                        newMessage={newMessage}
                        onNewMessageChange={handleTyping}
                        typingIndicator={typingUsers[selectedChat._id]}
                 
                        onFileSelectedForPreview={handleFileSelectedForPreview}
                        isFileBeingProcessed={isProcessingFile}
                        isActuallyUploading={isActuallyUploadingOrConverting}
                    />
                ) : ( <div className="no-chat-selected"><p>Select a chat to start messaging or search for users to begin a new conversation.</p></div> )}
            </div>

            <FileUploadConfirmationDialog
                isOpen={isConfirmationDialogVisible}
                file={fileForConfirmation}
                onConfirm={handleConfirmAndUploadFile}
                onCancel={handleCancelFileUpload}
                isActuallyUploading={isActuallyUploadingOrConverting}
            />

                        onChatUpdated={handleChatUpdated} // Memoized
                    />
                ) : ( <div className="no-chat-selected"><p>Select a chat or start a new conversation.</p></div> )}
            </div>
            {showCreateGroupModal && user && (
                <CreateGroupModal currentUser={user} onClose={() => setShowCreateGroupModal(false)} onGroupCreated={handleGroupCreated} />
            )}

        </div>
    );
};
export default ChatPage;
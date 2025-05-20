// client/src/components/Chat/ChatPage.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import UserList from './UserList';
import ChatWindow from './ChatWindow';
import CreateGroupModal from '../Group/CreateGroupModal';
import { fetchUserChatsAPI, accessOrCreateChatAPI, getMessagesAPI } from '../../services/api';
import './ChatPage.css';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

const ChatPage = () => {
    const { user, logout, isAuthenticated } = useAuth(); // user object from context
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const socketRef = useRef(null);
    const [typingUsers, setTypingUsers] = useState({});
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
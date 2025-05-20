// src/components/Chat/ChatPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import UserList from './UserList';
import ChatWindow from './ChatWindow';
import { fetchUserChatsAPI, accessOrCreateChatAPI, getMessagesAPI } from '../../services/api';
import './ChatPage.css';

const SOCKET_SERVER_URL = 'http://localhost:5001';

const ChatPage = () => {
    const { user, logout, isAuthenticated } = useAuth();
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const socketRef = useRef(null);
    const [typingUsers, setTypingUsers] = useState({});

    // Ref to hold the current selectedChat, accessible by socket event handlers
    const selectedChatRef = useRef(null);
    useEffect(() => {
        selectedChatRef.current = selectedChat; // Keep ref updated with selectedChat state
    }, [selectedChat]);


    const emitMessageReadIfNeeded = (msg, currentChatId, currentUserId) => {
        if (socketRef.current && msg.sender && msg.sender._id !== currentUserId &&
            currentUserId && // Ensure currentUserId is valid
            (!msg.readBy || !msg.readBy.map(u => u.toString()).includes(currentUserId.toString()))) {
            console.log(`ChatPage: Emitting 'messageRead' for msgId: ${msg._id}, chatId: ${currentChatId}, by userId: ${currentUserId}`);
            socketRef.current.emit('messageRead', {
                messageId: msg._id,
                chatId: currentChatId,
                userId: currentUserId
            });
        }
    };

    // Initialize and manage Socket Connection
    useEffect(() => {
        if (!isAuthenticated || !user?._id) {
            if (socketRef.current) {
                console.log('ChatPage SocketEffect: Not authenticated. Disconnecting existing socket.');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        if (!socketRef.current) { // Only initialize if not already set up
            console.log('ChatPage SocketEffect: Initializing socket for user:', user._id);
            socketRef.current = io(SOCKET_SERVER_URL);

            socketRef.current.on('connect', () => {
                console.log('ChatPage Socket: Connected, Socket ID:', socketRef.current.id);
                socketRef.current.emit('userOnline', user._id);
            });

            socketRef.current.on('receiveMessage', (incomingMessage) => {
                console.log('ChatPage Socket: receiveMessage event. Incoming:', incomingMessage, 'Current selectedChat (from ref):', selectedChatRef.current?._id);
                // Use selectedChatRef.current to check against the active chat
                if (selectedChatRef.current && incomingMessage.chatId === selectedChatRef.current._id) {
                    setMessages((prevMessages) => [...prevMessages, incomingMessage]);
                    if (user && user._id) {
                        emitMessageReadIfNeeded(incomingMessage, selectedChatRef.current._id, user._id);
                    }
                } else {
                    console.log('ChatPage Socket: New message for unselected chat or no selected chat.');
                    // Update chat list for unread indicators or last message preview
                    setChats(prevChats => {
                        let chatExistsInList = false;
                        const updatedChats = prevChats.map(chat => {
                            if (chat._id === incomingMessage.chatId) {
                                chatExistsInList = true;
                                return { ...chat, lastMessage: incomingMessage, updatedAt: incomingMessage.timestamp };
                            }
                            return chat;
                        });
                        // If the chat for the incoming message isn't in the list,
                        // it means it's a new chat initiated by the other user.
                        // We might need to fetch chats again or intelligently add it.
                        if (!chatExistsInList) {
                            console.warn(`ChatPage Socket: Received message for a new chat (${incomingMessage.chatId}) not yet in the list. Re-fetching chats.`);
                            loadUserChats(); // Re-fetch all chats to include the new one
                        }
                        return updatedChats.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    });
                }
            });

            socketRef.current.on('messageStatusUpdate', ({ messageId, status, readBy }) => {
                console.log(`ChatPage Socket: 'messageStatusUpdate' received. MsgID: ${messageId}, New Status: ${status}, ReadBy:`, readBy);
                setMessages(prevMessages =>
                    prevMessages.map(msg =>
                        msg._id === messageId ? { ...msg, status, readBy } : msg
                    )
                );
            });

            socketRef.current.on('userTyping', ({ chatId: typingChatId, userName }) => {
                if (selectedChatRef.current && typingChatId === selectedChatRef.current._id) {
                    setTypingUsers(prev => ({ ...prev, [typingChatId]: `${userName} is typing...` }));
                }
            });
            socketRef.current.on('userStopTyping', ({ chatId: typingChatId }) => {
                 if (selectedChatRef.current && typingChatId === selectedChatRef.current._id) {
                    setTypingUsers(prev => { const newState = { ...prev }; delete newState[typingChatId]; return newState; });
                }
            });
            socketRef.current.on('disconnect', () => { console.log('ChatPage Socket: Disconnected'); });
            socketRef.current.on('connect_error', (error) => { console.error('ChatPage Socket: Connection error:', error); });
        }

        // Cleanup function
        return () => {
            if (socketRef.current && user?._id) { // Check user._id for consistency
                console.log('ChatPage SocketEffect Cleanup: Disconnecting socket for user:', user._id);
                socketRef.current.disconnect();
                socketRef.current = null; // Important to allow re-initialization if user logs out and back in
            }
        };
    }, [user, isAuthenticated]); // Dependencies for setting up/tearing down the socket connection itself

    const loadUserChats = async () => {
        if (isAuthenticated && user && user._id) {
            console.log('ChatPage loadUserChats: Fetching user chats...');
            try {
                const response = await fetchUserChatsAPI();
                const fetchedChats = response.data;
                if (Array.isArray(fetchedChats)) {
                    fetchedChats.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    setChats(fetchedChats);
                    console.log('ChatPage loadUserChats: Chats fetched:', fetchedChats.length);
                } else {
                    console.error('ChatPage loadUserChats: Fetched chats is not an array:', fetchedChats);
                    setChats([]);
                }
            } catch (error) {
                console.error("ChatPage loadUserChats: Failed to fetch chats:", error.response?.data || error.message || error);
                setChats([]);
            }
        } else {
            console.log('ChatPage loadUserChats: Not authenticated or user info missing, clearing chats.');
            setChats([]);
        }
    };

    useEffect(() => {
        loadUserChats();
    }, [user, isAuthenticated]);

    useEffect(() => {
        console.log('ChatPage selectedChat-useEffect: Current selectedChat ID:', selectedChat?._id);
        if (selectedChat && selectedChat._id && user && user._id) {
            const loadMessages = async () => {
                console.log('ChatPage loadMessages: Fetching messages for chat ID:', selectedChat._id);
                setLoadingMessages(true);
                setMessages([]);
                try {
                    const response = await getMessagesAPI(selectedChat._id);
                    const fetchedMessages = response.data;
                    if (Array.isArray(fetchedMessages)) {
                        setMessages(fetchedMessages);
                        console.log('ChatPage loadMessages: Messages fetched:', fetchedMessages.length);
                        if (socketRef.current) { // Ensure socket is connected
                            socketRef.current.emit('joinChat', selectedChat._id);
                            console.log(`ChatPage loadMessages: Emitted 'joinChat' for room ${selectedChat._id}`);
                            fetchedMessages.forEach(msg => {
                                emitMessageReadIfNeeded(msg, selectedChat._id, user._id);
                            });
                        }
                    } else {
                        console.error('ChatPage loadMessages: Fetched messages is not an array:', fetchedMessages);
                        setMessages([]);
                    }
                } catch (error) {
                    console.error("ChatPage loadMessages: Failed to fetch messages:", error.response?.data || error.message || error);
                    setMessages([]);
                } finally {
                    setLoadingMessages(false);
                }
            };
            loadMessages();

            const chatToLeave = selectedChat._id; // Capture the ID for cleanup
            return () => {
                if (socketRef.current && chatToLeave) {
                    socketRef.current.emit('leaveChat', chatToLeave);
                    console.log(`ChatPage selectedChat-useEffect Cleanup: Emitted 'leaveChat' for room ${chatToLeave}`);
                }
            };
        } else {
            console.log('ChatPage selectedChat-useEffect: No valid selectedChat or user. Clearing messages.');
            setMessages([]);
        }
    }, [selectedChat, user]); // user dependency is for emitMessageReadIfNeeded

    const handleSelectChat = async (chatOrUserId) => {
        console.log('ChatPage handleSelectChat: Called with ->', chatOrUserId);
        if (selectedChatRef.current && selectedChatRef.current._id === (typeof chatOrUserId === 'string' ? null : chatOrUserId?._id)) {
            console.log('ChatPage handleSelectChat: Same chat selected, doing nothing.');
            return;
        }

        setMessages([]);
        setTypingUsers({});
        setSelectedChat(null); // Trigger loading state for ChatWindow

        if (typeof chatOrUserId === 'string') {
            console.log('ChatPage handleSelectChat: Argument is userId:', chatOrUserId);
            try {
                const response = await accessOrCreateChatAPI(chatOrUserId);
                const newChat = response.data;
                console.log('ChatPage handleSelectChat: API response from accessOrCreateChatAPI ->', newChat);
                if (newChat && newChat._id) {
                    setSelectedChat(newChat);
                    // Update chats list intelligently
                    setChats(prevChats => {
                        const existingChatIndex = prevChats.findIndex(c => c._id === newChat._id);
                        if (existingChatIndex > -1) { // Chat exists, move to top
                            const updatedChats = [...prevChats];
                            const existing = updatedChats.splice(existingChatIndex, 1)[0];
                            return [Object.assign(existing, newChat), ...updatedChats]; // Update existing with new data and move to top
                        } else { // New chat
                            return [newChat, ...prevChats].sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                        }
                    });
                } else {
                    console.error('ChatPage handleSelectChat: Invalid chat object from API. Received:', newChat);
                    setSelectedChat(null); // Ensure selectedChat remains null on error
                }
            } catch (error) {
                console.error("ChatPage handleSelectChat: Failed to access/create chat:", error.response?.data || error.message || error);
                setSelectedChat(null);
            }
        } else {
            console.log('ChatPage handleSelectChat: Argument is chat object:', chatOrUserId?._id);
            if (chatOrUserId && chatOrUserId._id) {
                setSelectedChat(chatOrUserId);
            } else {
                console.error('ChatPage handleSelectChat: Attempted to select invalid chat object:', chatOrUserId);
                setSelectedChat(null);
            }
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        console.log('ChatPage handleSendMessage: Attempting message. selectedChat ID:', selectedChatRef.current?._id, 'User ID:', user?._id);

        if (newMessage.trim() && selectedChatRef.current && selectedChatRef.current._id && user && user._id) {
            const messageData = {
                chatId: selectedChatRef.current._id, // Use ref here
                senderId: user._id,
                content: { text: newMessage.trim() },
                type: 'text',
            };
            console.log('ChatPage handleSendMessage: Emitting "sendMessage" with data:', messageData);
            if (socketRef.current) {
                socketRef.current.emit('sendMessage', messageData);
            } else { console.error('ChatPage handleSendMessage: socketRef.current is null.'); }
            setNewMessage('');
            if (socketRef.current && selectedChatRef.current._id) { // Use ref
                socketRef.current.emit('stopTyping', { chatId: selectedChatRef.current._id });
            }
        } else {
            console.warn('ChatPage handleSendMessage: CANNOT send. Conditions not met. Details:',
                { hasMsg: !!newMessage.trim(), selChatId: !!selectedChatRef.current?._id, userId: !!user?._id });
        }
    };

    const typingTimeoutRef = useRef(null);
    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!socketRef.current || !selectedChatRef.current?._id || !user?.name) return;

        socketRef.current.emit('typing', { chatId: selectedChatRef.current._id, userName: user.name });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current && selectedChatRef.current?._id) {
                socketRef.current.emit('stopTyping', { chatId: selectedChatRef.current._id });
            }
        }, 2000);
    };

    if (!isAuthenticated) {
        return <div className="chat-page-container"><div className="no-chat-selected"><p>Please log in to access your chats.</p></div></div>;
    }

    return (
        <div className="chat-page-container">
            <div className="sidebar">
                <div className="sidebar-header"><h3>Chats</h3><button onClick={logout}>Logout</button></div>
                <UserList chats={chats} onSelectChat={handleSelectChat} currentUser={user} selectedChatId={selectedChat?._id} />
            </div>
            <div className="chat-area">
                {selectedChat && selectedChat._id ? (
                    <ChatWindow chat={selectedChat} messages={messages} loadingMessages={loadingMessages} currentUser={user} onSendMessage={handleSendMessage} newMessage={newMessage} onNewMessageChange={handleTyping} typingIndicator={typingUsers[selectedChat._id]} />
                ) : ( <div className="no-chat-selected"><p>Select a chat to start messaging or search for users to begin a new conversation.</p></div> )}
            </div>
        </div>
    );
};

export default ChatPage;
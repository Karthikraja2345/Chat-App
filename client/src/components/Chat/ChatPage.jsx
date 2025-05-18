// src/components/Chat/ChatPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import UserList from './UserList'; // Component to list users/chats
import ChatWindow from './ChatWindow'; // Component for messages
import { fetchUserChatsAPI, accessOrCreateChatAPI, getMessagesAPI } from '../../services/api';
import './ChatPage.css'; // Styles for chat page

const SOCKET_SERVER_URL = 'http://localhost:5001'; // Your backend URL

const ChatPage = () => {
    const { user, logout, isAuthenticated } = useAuth(); // Added isAuthenticated
    console.log('ChatPage: user object from useAuth():', user); // Log the user object
    console.log('ChatPage: user._id:', user?._id);
    console.log('ChatPage: user.id:', user?.id);
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const socketRef = useRef(null);
    const [typingUsers, setTypingUsers] = useState({});

    // Initialize Socket Connection
    useEffect(() => {
        if (!isAuthenticated || !user) {
            console.log('ChatPage SocketInit: Not authenticated or user is null, skipping socket connection.');
            if (socketRef.current) { // If socket was previously connected, disconnect it
                console.log('ChatPage SocketInit: Disconnecting existing socket.');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        if (!socketRef.current) { // Only initialize if not already connected
            console.log('ChatPage SocketInit: Initializing socket connection for user:', user.id);
            socketRef.current = io(SOCKET_SERVER_URL);

            socketRef.current.on('connect', () => {
                console.log('ChatPage Socket: Connected to socket server:', socketRef.current.id);
                socketRef.current.emit('userOnline', user._id);
            });

            socketRef.current.on('receiveMessage', (incomingMessage) => {
                console.log('ChatPage Socket: receiveMessage event. Incoming:', incomingMessage, 'Current selectedChat:', selectedChat);
                if (selectedChat && incomingMessage.chatId === selectedChat._id) {
                    setMessages((prevMessages) => [...prevMessages, incomingMessage]);
                    if (user && incomingMessage.sender?._id !== user.id) { // Check user and sender._id
                        console.log('ChatPage Socket: Marking received message as read.');
                        socketRef.current.emit('messageRead', {
                            messageId: incomingMessage._id,
                            chatId: selectedChat._id,
                            userId: user.id
                        });
                    }
                } else {
                    console.log('ChatPage Socket: New message for unselected chat or no selected chat.');
                    setChats(prevChats => {
                        let chatExists = false;
                        const updatedChats = prevChats.map(chat => {
                            if (chat._id === incomingMessage.chatId) {
                                chatExists = true;
                                return { ...chat, lastMessage: incomingMessage, updatedAt: incomingMessage.timestamp };
                            }
                            return chat;
                        });
                        // If chat doesn't exist in list (e.g. new chat initiated by other user), fetch all chats again to get it
                        // This is a simpler approach for now than trying to manually insert it with all populated fields.
                        if(!chatExists) {
                             console.warn("ChatPage Socket: Received message for a chat not in current list. Consider re-fetching chats.");
                             // loadUserChats(); // You might want a function to reload chats
                        }
                        return updatedChats.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    });
                }
            });

            socketRef.current.on('messageStatusUpdate', ({ messageId, status, readBy }) => {
                console.log('ChatPage Socket: messageStatusUpdate event:', { messageId, status, readBy });
                setMessages(prevMessages =>
                    prevMessages.map(msg =>
                        msg._id === messageId ? { ...msg, status, readBy } : msg
                    )
                );
            });

            socketRef.current.on('userTyping', ({ chatId: typingChatId, userName }) => { // Renamed chatId to avoid conflict
                if (selectedChat && typingChatId === selectedChat._id) {
                    setTypingUsers(prev => ({ ...prev, [typingChatId]: `${userName} is typing...` }));
                }
            });

            socketRef.current.on('userStopTyping', ({ chatId: typingChatId }) => { // Renamed
                 if (selectedChat && typingChatId === selectedChat._id) {
                    setTypingUsers(prev => {
                        const newState = { ...prev };
                        delete newState[typingChatId];
                        return newState;
                    });
                }
            });

            socketRef.current.on('disconnect', () => {
                console.log('ChatPage Socket: Disconnected from socket server');
            });

            socketRef.current.on('connect_error', (error) => {
                console.error('ChatPage Socket: Connection error:', error);
            });
        }

        // Clean up on component unmount
        return () => {
            if (socketRef.current && user) { // Check user also
                console.log('ChatPage SocketCleanup: Disconnecting socket for user:', user.id);
                // socketRef.current.emit('userOffline', user.id); // Server should handle this on 'disconnect'
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [user, isAuthenticated, selectedChat]); // Added selectedChat to dependencies for receiveMessage logic. Be careful with this.

    const loadUserChats = async () => {
        if (isAuthenticated && user) {
            console.log('ChatPage loadUserChats: Fetching user chats...');
            try {
                const response = await fetchUserChatsAPI(); // Assuming this returns response.data as the array
                const fetchedChats = response.data;
                if (Array.isArray(fetchedChats)) {
                    fetchedChats.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                    setChats(fetchedChats);
                    console.log('ChatPage loadUserChats: Chats fetched successfully:', fetchedChats.length, 'chats');
                } else {
                    console.error('ChatPage loadUserChats: Fetched chats is not an array:', fetchedChats);
                    setChats([]);
                }
            } catch (error) {
                console.error("ChatPage loadUserChats: Failed to fetch chats:", error.response?.data || error.message || error);
                setChats([]);
            }
        } else {
            console.log('ChatPage loadUserChats: Not authenticated or user is null, clearing chats.');
            setChats([]);
        }
    };

    // Fetch user's chats on load
    useEffect(() => {
        loadUserChats();
    }, [user, isAuthenticated]); // Re-fetch when user or isAuthenticated changes

    // Fetch messages when a chat is selected
    useEffect(() => {
        console.log('ChatPage selectedChat-useEffect: Current selectedChat:', selectedChat);
        if (selectedChat && selectedChat._id && user) {
            const loadMessages = async () => {
                console.log('ChatPage loadMessages: Fetching messages for chat ID:', selectedChat._id);
                setLoadingMessages(true);
                setMessages([]); // Clear previous messages
                try {
                    const response = await getMessagesAPI(selectedChat._id); // Assuming this returns response.data
                    const fetchedMessages = response.data;
                    if (Array.isArray(fetchedMessages)) {
                        setMessages(fetchedMessages);
                        console.log('ChatPage loadMessages: Messages fetched:', fetchedMessages.length, 'messages');
                        if (socketRef.current) {
                            socketRef.current.emit('joinChat', selectedChat._id);
                            console.log(`ChatPage loadMessages: Joined socket room for chat ${selectedChat._id}`);
                            fetchedMessages.forEach(msg => {
                                if (msg.sender && msg.sender._id !== user.id && (!msg.readBy || !msg.readBy.includes(user.id))) {
                                     console.log(`ChatPage loadMessages: Emitting messageRead for msg ${msg._id}`);
                                     socketRef.current.emit('messageRead', {
                                        messageId: msg._id,
                                        chatId: selectedChat._id,
                                        userId: user.id
                                    });
                                }
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

            // Leave previous chat room if any
            // This cleanup should use the value of selectedChat from when the effect ran
            const currentChatToLeave = selectedChat._id;
            return () => {
                if (socketRef.current && currentChatToLeave) {
                    socketRef.current.emit('leaveChat', currentChatToLeave);
                    console.log(`ChatPage selectedChat-useEffect Cleanup: Left socket room for chat ${currentChatToLeave}`);
                }
            };
        } else {
            console.log('ChatPage selectedChat-useEffect: No valid selectedChat or user. Clearing messages.');
            setMessages([]); // Clear messages if no chat is selected
        }
    }, [selectedChat, user]);

    const handleSelectChat = async (chatOrUserId) => {
        console.log('ChatPage handleSelectChat: Called with ->', chatOrUserId);
        setMessages([]); // Clear messages of previously selected chat
        setTypingUsers({}); // Clear typing indicators
        setSelectedChat(null); // Indicate loading/transition

        if (typeof chatOrUserId === 'string') { // It's a userId, create/access chat
            console.log('ChatPage handleSelectChat: Argument is a userId. Accessing/Creating chat for userId:', chatOrUserId);
            try {
                const response = await accessOrCreateChatAPI(chatOrUserId); // API call
                const newChat = response.data; // The actual chat object is in response.data
                console.log('ChatPage handleSelectChat: API response from accessOrCreateChatAPI ->', newChat);

                if (newChat && newChat._id) { // VALIDATION
                    setSelectedChat(newChat);
                    console.log('ChatPage handleSelectChat: setSelectedChat with new chat ->', newChat._id);
                    // Update chats list: if chat not present, add it. If present, could update it (e.g. make it selected).
                    setChats(prevChats => {
                        const existingChatIndex = prevChats.findIndex(c => c._id === newChat._id);
                        if (existingChatIndex > -1) {
                            // Optionally move to top or update, for now, just ensure it's there
                            // let updatedChats = [...prevChats];
                            // updatedChats[existingChatIndex] = newChat; // Or merge if newChat is more up-to-date
                            // return updatedChats.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                            return prevChats; // If already exists, list order might be managed by last message time
                        } else {
                            return [newChat, ...prevChats].sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
                        }
                    });
                } else {
                    console.error('ChatPage handleSelectChat: Invalid chat object received from API. Chat or chat._id is missing. Received:', newChat);
                    // Potentially show an error to the user
                }
            } catch (error) {
                console.error("ChatPage handleSelectChat: Failed to access/create chat via API:", error.response?.data || error.message || error);
                // Potentially show an error to the user
            }
        } else { // It's a full chat object (likely from existing chat list)
            console.log('ChatPage handleSelectChat: Argument is a chat object. Selecting chat:', chatOrUserId?._id);
            if (chatOrUserId && chatOrUserId._id) { // VALIDATION
                setSelectedChat(chatOrUserId);
            } else {
                console.error('ChatPage handleSelectChat: Attempted to select an invalid chat object:', chatOrUserId);
            }
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        console.log('ChatPage handleSendMessage: Attempting to send message.');
        console.log('ChatPage handleSendMessage: Current selectedChat value:', selectedChat);
        console.log('ChatPage handleSendMessage: Current selectedChat._id value:', selectedChat?._id);
        console.log('ChatPage handleSendMessage: Current user value:', user);
        console.log('ChatPage handleSendMessage: Current newMessage value:', newMessage);

        if (newMessage.trim() && selectedChat && selectedChat._id && user && user._id) {
            const messageData = {
                chatId: selectedChat._id,
                senderId: user._id,
                content: { text: newMessage.trim() },
                type: 'text',
            };
            console.log('ChatPage handleSendMessage: Emitting "sendMessage" with data:', messageData);
            if (socketRef.current) {
                socketRef.current.emit('sendMessage', messageData);
            } else {
                console.error('ChatPage handleSendMessage: socketRef.current is null. Cannot emit message.');
            }
            setNewMessage('');
            if (socketRef.current && selectedChat._id) {
                socketRef.current.emit('stopTyping', { chatId: selectedChat._id });
            }
        } else {
            console.warn('ChatPage handleSendMessage: CANNOT send message. Conditions not met. Details:',
                {
                    hasMessage: !!newMessage.trim(),
                    hasSelectedChat: !!selectedChat,
                    hasSelectedChatId: !!selectedChat?._id,
                    hasUser: !!user,
                    hasUserId: !!user?._id
                }
            );
        }
    };

    const typingTimeoutRef = useRef(null);
    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!socketRef.current || !selectedChat || !user || !user.name) return; // Ensure user.name exists for typing indicator

        socketRef.current.emit('typing', { chatId: selectedChat._id, userName: user.name });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current && selectedChat?._id) { // Check selectedChat._id too
                socketRef.current.emit('stopTyping', { chatId: selectedChat._id });
            }
        }, 2000);
    };

    if (!isAuthenticated) { // Early return if not authenticated
        console.log("ChatPage: User not authenticated, rendering login prompt.");
        return <div className="chat-page-container"><div className="no-chat-selected"><p>Please log in to access your chats.</p></div></div>;
    }

    return (
        <div className="chat-page-container">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h3>Chats</h3>
                    <button onClick={logout}>Logout</button>
                </div>
                <UserList
                    chats={chats}
                    onSelectChat={handleSelectChat}
                    currentUser={user}
                    selectedChatId={selectedChat?._id}
                />
            </div>
            <div className="chat-area">
                {selectedChat && selectedChat._id ? ( // Ensure selectedChat and its _id are valid before rendering ChatWindow
                    <ChatWindow
                        chat={selectedChat}
                        messages={messages}
                        loadingMessages={loadingMessages}
                        currentUser={user}
                        onSendMessage={handleSendMessage}
                        newMessage={newMessage}
                        onNewMessageChange={handleTyping}
                        typingIndicator={typingUsers[selectedChat._id]}
                    />
                ) : (
                    <div className="no-chat-selected">
                        <p>Select a chat to start messaging or search for users to begin a new conversation.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
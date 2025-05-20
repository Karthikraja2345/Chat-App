// src/components/Chat/UserList.jsx
import React, { useState, useEffect } from 'react';
import { searchUsersAPI } from '../../services/api'; // Adjust if api.js is elsewhere
import './ChatPage.css'; // Or a specific UserList.css

const UserList = ({ chats, onSelectChat, currentUser, selectedChatId }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isActuallyFetching, setIsActuallyFetching] = useState(false); // Renamed for clarity

    useEffect(() => {
        // Ensure currentUser is available and has an _id before using it in dependencies or filters
        if (!currentUser?._id) {
            console.log('UserList useEffect: currentUser is not available yet or has no _id. Search will not run.');
            setSearchResults([]); // Clear previous results if user logs out/changes
            return;
        }

        if (searchTerm.trim() === '') {
            setSearchResults([]);
            setIsActuallyFetching(false); // Not fetching if term is empty
            console.log('UserList useEffect: Search term is empty. Cleared results and fetching state.');
            return; // Exit if search term is empty
        }

        // This log shows whenever searchTerm changes and isn't empty
        console.log('UserList useEffect: Search term updated to ->', searchTerm);

        setIsActuallyFetching(true); // Indicate that a fetch operation is about to start (or is debouncing)
        console.log('UserList useEffect: Debounce timer starting for search term ->', searchTerm);

         const delayDebounceFn = setTimeout(async () => {
            console.log('UserList Debounce: Timer elapsed. Calling searchUsersAPI for ->', searchTerm);
            try {
                const response = await searchUsersAPI(searchTerm); // Get the full Axios response
                const usersArray = response.data; // <--- ACCESS THE DATA ARRAY HERE

                // Check if usersArray is actually an array before trying to filter
                if (Array.isArray(usersArray)) {
                    const filteredUsers = usersArray.filter(user => currentUser && user._id !== currentUser._id);
                    setSearchResults(filteredUsers);
                    console.log('UserList Debounce: API results received for "' + searchTerm + '":', filteredUsers);
                } else {
                    // This case might happen if the backend doesn't send an array (e.g., error, or unexpected format)
                    console.error('UserList Debounce: API response.data is not an array:', usersArray);
                    setSearchResults([]); // Set to empty array if data is not as expected
                }
            } catch (error) {
                console.error("UserList Debounce: Error searching users via API:", error.response?.data || error.message || error);
                setSearchResults([]); // Clear results on error
            } finally {
                setIsActuallyFetching(false);
                console.log('UserList Debounce: API call finished. isActuallyFetching set to false.');
            }
        }, 700); // Debounce search (e.g., 700ms)

        // Cleanup function for the timeout
        return () => {
            clearTimeout(delayDebounceFn);
            console.log('UserList Cleanup: Debounce timer cleared for search term ->', searchTerm);
        };
    }, [searchTerm, currentUser]); // Depend on searchTerm and currentUser

    const handleSelectUserFromSearch = (user) => {
        console.log('UserList: User selected from search:', user);
        onSelectChat(user._id); // Pass userId to create/access chat
        setSearchTerm(''); // Clear search input
        setSearchResults([]); // Clear search results list
        setIsActuallyFetching(false); // No longer fetching
    };

    // Function to get the other participant in a 1-on-1 chat
    const getChatPartner = (chat) => {
        if (currentUser && !chat.isGroupChat && chat.participants) {
            return chat.participants.find(p => p._id !== currentUser._id);
        }
        return null;
    };

    // Function to get a display name for the chat
    const getChatDisplayName = (chat) => {
        if (chat.isGroupChat) {
            return chat.name || "Group Chat";
        }
        const partner = getChatPartner(chat);
        return partner ? partner.name || partner.phoneNumber : "Unknown User"; // Fallback to phone
    };

    // Function to get profile picture for the chat
    const getChatDisplayPicture = (chat) => {
         if (chat.isGroupChat) {
            return chat.groupIcon || 'src/assets/male.png'; // Placeholder group icon
        }
        const partner = getChatPartner(chat);
        return partner ? partner.profilePicture || '"src/assets/male.png"' : '"src/assets/male.png"';
    };


    const truncateText = (text, maxLength = 30) => {
        if (!text) return "";
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    };

    const showSearchResults = searchTerm.trim() !== '';
    const showChatList = !showSearchResults;

    return (
        <div className="user-list-container">
            <div className="search-bar-container">
                <input
                    type="text"
                    placeholder="Search users or groups..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            {showSearchResults && (
                <div className="search-results-section">
                    {isActuallyFetching && searchResults.length === 0 && <p className="no-results">Searching...</p>}
                    {!isActuallyFetching && searchResults.length === 0 && <p className="no-results">No users found for "{searchTerm}".</p>}
                    {searchResults.length > 0 && (
                        <div className="search-results-list">
                            <h4>Search Results:</h4>
                            {searchResults.map((userResult) => (
                                <div
                                    key={userResult._id}
                                    className="user-list-item"
                                    onClick={() => handleSelectUserFromSearch(userResult)}
                                >
                                    <img src={userResult.profilePicture || 'https://via.placeholder.com/40'} alt={userResult.name || userResult.phoneNumber} className="avatar" />
                                    <div className="user-info">
                                        <span className="user-name">{userResult.name || userResult.phoneNumber}</span>
                                        {userResult.name && <small>{userResult.phoneNumber}</small>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}


            {showChatList && (
                 <div className="chat-list">
                    {currentUser && chats && chats.length > 0 ? ( // Check currentUser for getChatPartner
                        chats.map((chat) => (
                            <div
                                key={chat._id}
                                className={`user-list-item ${selectedChatId === chat._id ? 'selected' : ''}`}
                                onClick={() => onSelectChat(chat)} // Pass full chat object
                            >
                                <img src={"src/assets/male.png"} alt="chat-avatar" className="avatar" />
                                <div className="user-info">
                                    <span className="user-name">{getChatDisplayName(chat)}</span>
                                    {chat.lastMessage && chat.lastMessage.sender && currentUser && ( // Check lastMessage.sender and currentUser
                                        <small className="last-message">
                                            {chat.lastMessage.sender._id === currentUser._id ? "You: " : ""}
                                            {truncateText(chat.lastMessage.content?.text || `Sent an ${chat.lastMessage.type}`)}
                                        </small>
                                    )}
                                </div>
                                {/* TODO: Add unread count badge */}
                            </div>
                        ))
                    ) : (
                        <p className="no-chats">No active chats. Search for users to start a conversation.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default UserList;
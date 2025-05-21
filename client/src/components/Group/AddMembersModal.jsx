// client/src/components/Group/AddMembersModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { addUserToGroupAPI, searchUsersAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './AddMembersModal.css';

const AddMembersModal = ({ chat, onClose, onGroupUpdated }) => {
    const { user: currentUser } = useAuth(); // currentUser is still used in the useEffect for search
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [loadingAdd, setLoadingAdd] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setSearchResults([]);
            return;
        }
        setLoadingSearch(true);
        const timer = setTimeout(async () => {
            try {
                const response = await searchUsersAPI(searchTerm);
                setSearchResults(
                    response.data.filter(userRes => // Renamed 'user' to 'userRes' to avoid conflict if needed
                        userRes._id !== currentUser._id && // currentUser._id IS used here
                        !chat.participants.find(p => p._id === userRes._id) &&
                        !selectedUsersToAdd.find(su => su._id === userRes._id)
                    )
                );
            } catch (err) {
                console.error("Error searching users for AddMembersModal:", err);
                setError("Failed to search users.");
            } finally {
                setLoadingSearch(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, currentUser._id, chat.participants, selectedUsersToAdd]); // currentUser._id is correctly a dependency HERE

    const handleUserSelect = (userToSelect) => { // Renamed 'user' to avoid conflict
        setSelectedUsersToAdd(prev => [...prev, userToSelect]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleRemoveSelectedUser = (userId) => {
        setSelectedUsersToAdd(prev => prev.filter(userToRemove => userToRemove._id !== userId)); // Renamed 'user'
    };

    const handleAddSelectedMembers = useCallback(async () => {
        if (selectedUsersToAdd.length === 0) {
            setError("Please select at least one user to add.");
            return;
        }
        setError('');
        setSuccess('');
        setLoadingAdd(true);

        let currentChatState = { ...chat };
        let addedCount = 0;
        const errorMessages = [];

        for (const user of selectedUsersToAdd) { // 'user' here is from the loop
            try {
                // console.log(`[AddMembersModal] Calling addUserToGroupAPI for chat ${currentChatState._id}, user ${user._id}`);
                const response = await addUserToGroupAPI(currentChatState._id, user._id);
                if (response.data && response.data._id) {
                    currentChatState = response.data;
                    addedCount++;
                } else {
                    throw new Error(`API response for adding user ${user.name} was invalid.`);
                }
            } catch (err) {
                const userAddError = err.response?.data?.message || err.message || `Failed to add user ${user.name}.`;
                errorMessages.push(userAddError);
            }
        }

        setLoadingAdd(false);
        
        if (addedCount > 0) {
            setSuccess(`${addedCount} user(s) added successfully.`);
            onGroupUpdated(currentChatState);
            setSelectedUsersToAdd([]); // Clear selection after successful additions
        }
        if (errorMessages.length > 0) {
            setError(`Errors: ${errorMessages.join('; ')}`);
        } else if (addedCount === 0 && selectedUsersToAdd.length > 0) { // No errors, but nothing added (e.g., all were already members or other silent issue)
            setError("No new users were added. They might already be members or an issue occurred.");
        }
        // If only some succeeded and some failed, both success and error messages might show.
        // Consider more refined logic here if needed.

    }, [chat, selectedUsersToAdd, onGroupUpdated]); // REMOVED currentUser._id from here

    // ... (rest of the component: isValidObjectId, return JSX) ...
    // The JSX part from the previous full answer is fine.
    return (
        <div className="modal-backdrop add-members-modal-backdrop">
            <div className="modal-content add-members-modal-content">
                <button onClick={onClose} className="modal-close-btn">×</button>
                <h3>Add Members to "{chat?.name || 'Group'}"</h3>
                {error && <p className="error-message" style={{color: 'red'}}>{error}</p>}
                {success && <p className="success-message" style={{color: 'green'}}>{success}</p>}

                <div className="form-group">
                    <label htmlFor="userSearchAddMember">Search Users</label>
                    <input
                        type="text"
                        id="userSearchAddMember"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name or phone number"
                        className="form-control"
                    />
                    {loadingSearch && <p className="loading-text">Searching...</p>}
                    <div className="search-results-for-group">
                        {searchResults.map(userRes => ( // Renamed user to userRes
                            <div key={userRes._id} className="user-search-item" onClick={() => handleUserSelect(userRes)}>
                                <img src="src/assets/male.png" alt={userRes.name} className="avatar-small" />
                                <span>{userRes.name || userRes.phoneNumber} ({userRes.email})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedUsersToAdd.length > 0 && (
                    <div className="selected-users-container">
                        <h4>Selected to Add:</h4>
                        <div className="selected-users-chips">
                            {selectedUsersToAdd.map(userChip => ( // Renamed user to userChip
                                <div key={userChip._id} className="user-chip">
                                    <span>{userChip.name || userChip.phoneNumber}</span>
                                    <button type="button" onClick={() => handleRemoveSelectedUser(userChip._id)} title="Remove selection">×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    <button onClick={onClose} className="btn btn-secondary" disabled={loadingAdd}>
                        Cancel
                    </button>
                    <button 
                        onClick={handleAddSelectedMembers} 
                        className="btn btn-primary" 
                        disabled={loadingAdd || selectedUsersToAdd.length === 0}
                    >
                        {loadingAdd ? "Adding..." : "Add Selected Members"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddMembersModal;
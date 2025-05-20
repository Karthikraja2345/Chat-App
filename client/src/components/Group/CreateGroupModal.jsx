import React, { useState, useEffect } from 'react';
import { searchUsersAPI, createGroupChatAPI } from '../../services/api';
import './GroupModal.css'; // Create this CSS file
  const CreateGroupModal = ({ currentUser, onClose, onGroupCreated }) => {
      const [groupName, setGroupName] = useState('');
      const [searchTerm, setSearchTerm] = useState('');
      const [searchResults, setSearchResults] = useState([]);
      const [selectedUsers, setSelectedUsers] = useState([]); // Array of user objects
      const [loadingSearch, setLoadingSearch] = useState(false);
      const [loadingCreate, setLoadingCreate] = useState(false);
      const [error, setError] = useState('');

      useEffect(() => {
          if (searchTerm.trim() === '') {
              setSearchResults([]);
              return;
          }
          setLoadingSearch(true);
          const timer = setTimeout(async () => {
              try {
                  const response = await searchUsersAPI(searchTerm);
                  // Filter out current user and already selected users
                  setSearchResults(
                      response.data.filter(user =>
                          user._id !== currentUser._id &&
                          !selectedUsers.find(su => su._id === user._id)
                      )
                  );
              } catch (err) {
                  console.error("Error searching users for group:", err);
              } finally {
                  setLoadingSearch(false);
              }
          }, 500);
          return () => clearTimeout(timer);
      }, [searchTerm, currentUser._id, selectedUsers]);

      const handleAddUser = (user) => {
          setSelectedUsers(prev => [...prev, user]);
          setSearchTerm(''); // Clear search to hide results
          setSearchResults([]);
      };

      const handleRemoveUser = (userId) => {
          setSelectedUsers(prev => prev.filter(user => user._id !== userId));
      };

      const handleCreateGroup = async () => {
          if (!groupName.trim()) {
              setError("Group name is required.");
              return;
          }
          if (selectedUsers.length < 1) { // Backend enforces 2+ total, so frontend should enforce 1+ selected
              setError("Please select at least one member for the group.");
              return;
          }
          setError('');
          setLoadingCreate(true);
          try {
              const userIds = selectedUsers.map(u => u._id);
              const groupData = {
                  name: groupName,
                  users: JSON.stringify(userIds) // Backend expects JSON string of user IDs
              };
              const response = await createGroupChatAPI(groupData);
              onGroupCreated(response.data); // Pass the new group chat object back
          } catch (err) {
              setError(err.response?.data?.message || "Failed to create group.");
              console.error("Error creating group:", err);
          } finally {
              setLoadingCreate(false);
          }
      };

      return (
          <div className="modal-overlay" onClick={onClose}>
              <div className="modal-content create-group-modal" onClick={(e) => e.stopPropagation()}>
                  <h2>Create New Group</h2>
                  {error && <p className="error-message">{error}</p>}
                  <div className="form-group">
                      <label htmlFor="groupName">Group Name</label>
                      <input
                          type="text"
                          id="groupName"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="Enter group name"
                      />
                  </div>

                  <div className="form-group">
                      <label htmlFor="userSearch">Add Members</label>
                      <input
                          type="text"
                          id="userSearch"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search users to add"
                      />
                      {loadingSearch && <p className="loading-text">Searching...</p>}
                      <div className="search-results-for-group">
                          {searchResults.map(user => (
                              <div key={user._id} className="user-search-item" onClick={() => handleAddUser(user)}>
                                  <img src={user.profilePicture || '/default-avatar.png'} alt={user.name} className="avatar-small" />
                                  <span>{user.name || user.phoneNumber}</span>
                              </div>
                          ))}
                      </div>
                  </div>

                  {selectedUsers.length > 0 && (
                      <div className="selected-users-container">
                          <h4>Selected Members:</h4>
                          <div className="selected-users-chips">
                              {selectedUsers.map(user => (
                                  <div key={user._id} className="user-chip">
                                      <span>{user.name || user.phoneNumber}</span>
                                      <button onClick={() => handleRemoveUser(user._id)}>×</button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  <div className="modal-actions">
                      <button onClick={onClose} className="btn-secondary" disabled={loadingCreate}>Cancel</button>
                      <button onClick={handleCreateGroup} className="btn-primary" disabled={loadingCreate}>
                          {loadingCreate ? "Creating..." : "Create Group"}
                      </button>
                  </div>
              </div>
          </div>
      );
  };
  export default CreateGroupModal;
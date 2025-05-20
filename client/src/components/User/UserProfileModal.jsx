// client/src/components/User/UserProfileModal.jsx
import React from 'react';
// import './UserProfileModal.css'; // CSS import

const UserProfileModal = ({ user, onClose }) => {
    if (!user) return null;

    return (
        <div className="modal-backdrop user-profile-modal-backdrop">
            <div className="modal-content user-profile-modal-content">
                <button onClick={onClose} className="modal-close-btn">×</button>
                <img
                    src={user.profilePicture || '/default-avatar.png'}
                    alt={user.name}
                    className="profile-avatar-large"
                />
                <h2>{user.name}</h2>
                {user.email && <p className="user-email">{user.email}</p>}
                {user.online && <p className="user-status-info online">Online</p>}
                {!user.online && user.lastSeen && (
                    <p className="user-status-info offline">
                        Last seen: {new Date(user.lastSeen).toLocaleString()}
                    </p>
                )}
                {user.createdAt && (
                    <p className="user-joined-date">
                        Joined: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                )}
                {/* Add more user details if needed, e.g., user._id for admins to copy */}
                <p style={{fontSize: '0.7em', color: '#aaa', marginTop: '10px'}}>User ID: {user._id}</p>
            </div>
        </div>
    );
};

export default UserProfileModal;
// src/components/Profile/ProfileSetupPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfileAPI } from '../../services/api'; // Adjust path as needed
import { useAuth } from '../../contexts/AuthContext'; // Adjust path as needed
import '../Auth/Auth.css'; // Assuming you want to reuse some auth styles

const ProfileSetupPage = () => {
    const [name, setName] = useState('');
    const [profilePicture, setProfilePicture] = useState(null); // For file object
    const [profilePicturePreview, setProfilePicturePreview] = useState(''); // For preview URL
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { user, setUser: updateUserContext } = useAuth(); // Use the context's setUser

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePicture(file);
            setProfilePicturePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Name is required.');
            return;
        }
        setError('');
        setLoading(true);

        const formData = new FormData();
        formData.append('name', name);
        if (profilePicture) {
            formData.append('profilePicture', profilePicture); // Backend needs to handle 'profilePicture' field
        }
        // If not uploading file directly, and just name and status:
        // const profileData = { name };

        try {
            // If backend handles multipart/form-data for profile picture
            // const response = await updateProfileAPI(formData);

            // If backend just takes JSON for name/status (and picture is handled separately or not yet)
            const response = await updateProfileAPI({ name }); // Pass as object

            updateUserContext(response.data); // Update user in context
            navigate('/'); // Navigate to main chat page
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container"> {/* Reusing auth container for similar layout */}
            <div className="auth-form">
                <h2>Setup Your Profile</h2>
                <p>Let's get you set up!</p>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Display Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            required
                        />
                    </div>
                    {/* Optional: Profile Picture Upload */}
                    {/* <div className="form-group">
                        <label htmlFor="profilePicture">Profile Picture (Optional)</label>
                        <input
                            type="file"
                            id="profilePicture"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        {profilePicturePreview && (
                            <img src={profilePicturePreview} alt="Profile Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', marginTop: '10px' }} />
                        )}
                    </div> */}
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Saving...' : 'Save Profile'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProfileSetupPage;
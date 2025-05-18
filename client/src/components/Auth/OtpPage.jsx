// src/components/Auth/OtpPage.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verifyOtpAPI } from '../../services/api'; // Adjust path if services/api.js is elsewhere
import { useAuth } from '../../contexts/AuthContext'; // Adjust path if contexts/AuthContext.jsx is elsewhere
import './Auth.css'; // Assuming you have this CSS file

const OtpPage = () => {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth(); // Destructure login from useAuth context

    // Access phone number passed via location state
    const phoneNumber = location.state?.phoneNumber;

    // Log for debugging
    useEffect(() => {
        console.log('OtpPage: Component mounted. location.state:', location.state);
        console.log('OtpPage: Extracted phoneNumber:', phoneNumber);
        if (!phoneNumber) {
            setError("Phone number not found in navigation state. Please go back to login.");
            // Optionally redirect after a delay if phone number is critical for this page
            // setTimeout(() => navigate('/login'), 3000);
        }
    }, [phoneNumber, location.state, navigate]); // Add location.state to dependencies

    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission (page reload)
        console.log('OtpPage: handleSubmit triggered. Submitted OTP:', otp);
        console.log('OtpPage: Phone number from state:', phoneNumber);

        if (!phoneNumber) {
            setError("Phone number is missing. Cannot verify OTP.");
            console.error('OtpPage: Phone number missing in handleSubmit.');
            return; // Stop execution
        }
        if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            setError("OTP must be 6 digits.");
            console.error('OtpPage: Invalid OTP format:', otp);
            return; // Stop execution
        }

        setError(''); // Clear previous errors
        setLoading(true); // Disable button and show loading state
        try {
            console.log('OtpPage: Calling verifyOtpAPI with phoneNumber:', phoneNumber, 'and otp:', otp);
            const response = await verifyOtpAPI(phoneNumber, otp);
            console.log('OtpPage: verifyOtpAPI successful response:', response.data);

            // Use the login function from AuthContext to update global auth state
            login(response.data.user, response.data.token);
            console.log('OtpPage: Auth context (login) updated.');

            // Determine navigation path based on profile setup status
            // The needsProfileSetup flag comes from the backend in authController.js
            if (response.data.user.needsProfileSetup) {
                console.log('OtpPage: User needs profile setup, navigating to /profile-setup');
                navigate('/profile-setup');
            } else {
                console.log('OtpPage: User profile is complete, navigating to /');
                navigate('/');
            }
        } catch (err) {
            console.error('OtpPage: verifyOtpAPI error object:', err);
            // Check if there's a response from the server with an error message
            if (err.response) {
                console.error('OtpPage: Error response data:', err.response.data);
                console.error('OtpPage: Error response status:', err.response.status);
            }
            setError(err.response?.data?.message || err.message || 'Failed to verify OTP. Please try again.');
        } finally {
            setLoading(false); // Re-enable button
            console.log('OtpPage: handleSubmit finished.');
        }
    };

    // Render an error message if phone number is not available
    if (!phoneNumber) {
         return (
            <div className="auth-container">
                <div className="auth-form">
                    <h2>Error</h2>
                    <p className="error-message">{error || "Phone number not provided for OTP verification."}</p>
                    <button onClick={() => navigate('/login')} className="auth-button">Back to Login</button>
                </div>
            </div>
        );
    }

    // Main OTP verification form
    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>Verify OTP</h2>
                <p>Enter the 6-digit OTP sent to {phoneNumber}</p>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="otp">OTP</label>
                        <input
                            type="text"
                            id="otp"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength="6"
                            placeholder="Enter OTP"
                            required
                        />
                    </div>
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                </form>
                <button onClick={() => navigate('/login')} style={{marginTop: '10px', background: 'transparent', border: 'none', color: '#667eea', cursor: 'pointer'}}>
                    Back to Login
                </button>
            </div>
        </div>
    );
};

export default OtpPage;
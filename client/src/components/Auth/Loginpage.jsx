// src/components/Auth/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtpAPI } from '../../services/api';
import './Auth.css'; // Create this for styling

const LoginPage = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('LoginPage: Send OTP button clicked. Phone number:', phoneNumber);
        setError('');
        setLoading(true);
        if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) { // Basic E.164 like validation
             setError('Please enter a valid phone number (e.g., +14155552671).');
             setLoading(false);
             return;
        }
        try {
            console.log('LoginPage: Calling sendOtpAPI...');
            await sendOtpAPI(phoneNumber);
            console.log('LoginPage: OTP sent successfully, navigating to /verify-otp');
            navigate('/verify-otp', { state: { phoneNumber } }); // Pass phone number to OTP page
        } catch (err) {
            console.error('LoginPage: Error sending OTP:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
            console.log('LoginPage: handleSubmit finished.');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>Welcome Back!</h2>
                <p>Enter your phone number to continue</p>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="phoneNumber">Phone Number</label>
                        <input
                            type="tel"
                            id="phoneNumber"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="e.g., +14155552671"
                            required
                        />
                    </div>
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Sending OTP...' : 'Send OTP'}
                    </button>
                </form>
            </div>
            <div className="auth-decoration">
                {/* Add some cool SVG or image here */}
                {/* <img src="/path-to-your-message-app-logo.svg" alt="Messaging App"/> */}
                <h3>Connect Instantly</h3>
            </div>
        </div>
    );
};

export default LoginPage;
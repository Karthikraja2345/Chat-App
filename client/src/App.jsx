// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import OtpPage from './components/Auth/OtpPage';
import ProfileSetupPage from './components/Profile/ProfileSetupPage';
import ChatPage from './components/Chat/ChatPage'; // Main page with user list and chat window
import './App.css'; // Your global styles

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <div>Loading...</div>; // Or a spinner
    return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppContent() {
    const { user, loading } = useAuth();

    if (loading) return <div>App Loading...</div>;

    // If user is authenticated but profile is not set up
    if (user && !user.name) { // Assuming 'name' is a key field for profile setup
        return (
            <Routes>
                <Route path="/profile-setup" element={<ProfileSetupPage />} />
                <Route path="*" element={<Navigate to="/profile-setup" />} /> {/* Redirect all else to profile setup */}
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
            <Route path="/verify-otp" element={user ? <Navigate to="/" /> : <OtpPage />} />
            <Route path="/" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            {/* Add more routes here for group specific views if needed, or handle within ChatPage */}
            <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
        </Routes>
    );
}


function App() {
    return (
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    );
}

export default App;
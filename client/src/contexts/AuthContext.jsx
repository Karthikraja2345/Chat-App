// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { getMyProfileAPI } from '../services/api'; // This path assumes api.js is in src/services/
import { jwtDecode } from 'jwt-decode'; // Use named import, often camelCase
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                try {
                    const decodedToken = jwtDecode(token);
                    if (decodedToken.exp * 1000 < Date.now()) {
                        console.log("Token expired, logging out.");
                        logout();
                        setLoading(false); // Ensure loading is set to false
                        return;
                    }
                    console.log("Token valid, fetching user profile...");
                    const response = await getMyProfileAPI();
                    console.log("User profile fetched:", response.data);
                    setUser(response.data);
                } catch (error) {
                    console.error('Failed to fetch user or token invalid/expired', error);
                    logout(); // Clear invalid token
                }
            }
            setLoading(false);
        };
        fetchUser();
    }, [token]); // Only re-run if token changes

    const login = (userData, authToken) => {
        console.log("Logging in user:", userData);
        localStorage.setItem('token', authToken);
        setToken(authToken); // This will trigger the useEffect above
        setUser(userData);
        setLoading(false); // Ensure loading is false after login
    };

    const logout = () => {
        console.log("Logging out user.");
        localStorage.removeItem('token');
        setToken(null); // This will trigger the useEffect above
        setUser(null);
        setLoading(false); // Ensure loading is false after logout
        // Optionally redirect to login page, but App.jsx handles this
    };

    const updateUserContext = (updatedUserData) => {
        console.log("Updating user context:", updatedUserData);
        setUser(prevUser => ({ ...prevUser, ...updatedUserData }));
    }

 console.log(
        "AuthContext Provider Render: loading =", loading,
        "user object:", user, // Log the whole user object
        "user._id:", user?._id,
        "user.id:", user?.id, // Specifically check user.id
        "isAuthenticated =", !!user && !!token
    );
    return (
        <AuthContext.Provider value={{ user, setUser: updateUserContext, login, logout, token, loading, isAuthenticated: !!user && !!token }}>
            {!loading && children}
            {loading && <div>Loading Authentication...</div>} {/* Show a clear loading message */}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
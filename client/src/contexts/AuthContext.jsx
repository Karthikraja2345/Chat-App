// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { getMyProfileAPI } from '../services/api';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Initialize token from localStorage synchronously
    const [token, setToken] = useState(() => localStorage.getItem('token'));

    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                try {
                    const decodedToken = jwtDecode(token);
                    if (decodedToken.exp * 1000 < Date.now()) {
                        console.log("AuthContext: Token expired, logging out effectively.");
                        localStorage.removeItem('token');
                        setToken(null); // This will cause re-render and user to be null if not already
                        setUser(null);
                        // No need to call logout() function here as it might cause infinite loop if logout also sets token
                    } else {
                        // console.log("AuthContext: Token valid, fetching user profile...");
                        const response = await getMyProfileAPI(); // Assumes API interceptor adds token
                        // console.log("AuthContext: User profile fetched:", response.data);
                        setUser(response.data);
                    }
                } catch (error) {
                    console.error('AuthContext: Failed to fetch user or token invalid/expired', error);
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                }
            } else {
                setUser(null); // Ensure user is null if no token
            }
            setLoading(false);
        };

        setLoading(true); // Set loading to true before starting the fetch/check
        fetchUser();

    }, [token]); // Re-run when token changes

    const login = (userData, authToken) => {
        // console.log("AuthContext: Logging in user:", userData);
        localStorage.setItem('token', authToken);
        setUser(userData); // Set user immediately for responsiveness
        setToken(authToken); // Then set token, which will trigger the useEffect
        setLoading(false); // Should be false after login completes
    };

    const logout = () => { // Make logout a stable function with useCallback if passed as prop
        // console.log("AuthContext: Logging out user.");
        localStorage.removeItem('token');
        setUser(null);
        setToken(null); // Triggers useEffect to ensure clean state if needed
        setLoading(false);
    };

    const updateUserContext = (updatedUserData) => {
        // console.log("AuthContext: Updating user context:", updatedUserData);
        setUser(prevUser => ({ ...prevUser, ...updatedUserData }));
    };
    
    // console.log("AuthContext Provider Render: user?._id:", user?._id, "loading:", loading, "isAuthenticated:", !!user && !!token);

    return (
        <AuthContext.Provider value={{ user, setUser: updateUserContext, login, logout, token, loading, isAuthenticated: !!user && !!token }}>
            {!loading ? children : <div>Loading Application...</div>}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined || context === null) { // Check against null if createContext(null)
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
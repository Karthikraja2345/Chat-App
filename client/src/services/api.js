// client/src/services/api.js
import axios from 'axios';

// Use import.meta.env for Vite environment variables
// It's good practice to provide a fallback for local development if .env is not set up
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const api = axios.create({
    baseURL: API_BASE_URL, // Use the resolved base URL
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add JWT token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// You can export the 'api' instance if you need to use it directly elsewhere,
// but often exporting individual functions is preferred.
// export default api;

// Auth service functions
export const sendOtpAPI = (phoneNumber) => api.post('/auth/send-otp', { phoneNumber });
export const verifyOtpAPI = (phoneNumber, otp) => api.post('/auth/verify-otp', { phoneNumber, otp });

// User service functions
export const getMyProfileAPI = () => api.get('/users/me');
export const updateProfileAPI = (profileData) => api.put('/users/profile', profileData);
export const searchUsersAPI = (query) => api.get(`/users/search?q=${query}`);


// Chat service functions
export const fetchUserChatsAPI = () => api.get('/chats');
export const accessOrCreateChatAPI = (userId) => api.post('/chats', { userId });
export const getMessagesAPI = (chatId) => api.get(`/chats/${chatId}/messages`);

// Group Chat specific functions
export const createGroupChatAPI = (groupData) => api.post('/chats/group', groupData);
export const renameGroupAPI = (chatId, chatName) => api.put('/chats/group/rename', {chatId, chatName});
export const addUserToGroupAPI = (chatId, userId) => api.put('/chats/group/add', {chatId, userId});
export const removeUserFromGroupAPI = (chatId, userId) => api.put('/chats/group/remove', {chatId, userId});

// Group Admin Management APIs
export const promoteToAdminAPI = (chatId, userId) => {
    return api.put('/chats/group/admin/add', { chatId, userId });
};
export const demoteAdminAPI = (chatId, userId) => {
    return api.put('/chats/group/admin/remove', { chatId, userId });
};

// Group Task API (Example)
export const addTaskToGroupAPI = (chatId, taskData) => api.post(`/chats/group/${chatId}/task`, taskData);
export const updateGroupTaskAPI = (chatId, taskId, taskUpdateData) => api.put(`/chats/group/${chatId}/task/${taskId}`, taskUpdateData);
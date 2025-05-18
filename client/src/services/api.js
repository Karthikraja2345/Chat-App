// src/services/api.js
import axios from 'axios';

const API_URL = 'http://localhost:5001/api'; // Your backend URL

const api = axios.create({
    baseURL: API_URL,
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

export default api;

// Auth service functions
export const sendOtpAPI = (phoneNumber) => api.post('/auth/send-otp', { phoneNumber });
export const verifyOtpAPI = (phoneNumber, otp) => api.post('/auth/verify-otp', { phoneNumber, otp });

// User service functions
export const getMyProfileAPI = () => api.get('/users/me');
export const updateProfileAPI = (profileData) => api.put('/users/profile', profileData); // Use FormData for file uploads
export const searchUsersAPI = (query) => api.get(`/users/search?q=${query}`);


// Chat service functions
export const fetchUserChatsAPI = () => api.get('/chats');
export const accessOrCreateChatAPI = (userId) => api.post('/chats', { userId });
export const getMessagesAPI = (chatId) => api.get(`/chats/${chatId}/messages`);
export const createGroupChatAPI = (groupData) => api.post('/chats/group', groupData); // groupData: { name, users: JSON.stringify([userId1, userId2]) }
export const renameGroupAPI = (chatId, chatName) => api.put('/chats/group/rename', {chatId, chatName});
export const addUserToGroupAPI = (chatId, userId) => api.put('/chats/group/add', {chatId, userId});
export const removeUserFromGroupAPI = (chatId, userId) => api.put('/chats/group/remove', {chatId, userId});

// Group Task API (Example)
export const addTaskToGroupAPI = (chatId, taskData) => api.post(`/chats/group/${chatId}/task`, taskData);
export const updateGroupTaskAPI = (chatId, taskId, taskUpdateData) => api.put(`/chats/group/${chatId}/task/${taskId}`, taskUpdateData);

// File upload (conceptual, if not using Cloudinary client-side SDK directly)
// export const uploadFileAPI = (formData) => api.post('/upload', formData, {
//     headers: { 'Content-Type': 'multipart/form-data' }
// });
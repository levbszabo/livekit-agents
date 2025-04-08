import axios from 'axios';
import { API_BASE_URL } from './config';

// Create a token variable in module scope that can be updated
let authToken: string | null = null;

// Function to set the auth token that can be called from components
export const setAuthToken = (token: string | null) => {
    authToken = token;

    // Update the Authorization header for future requests
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        // Remove the Authorization header if token is null
        delete api.defaults.headers.common['Authorization'];
    }
};

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api',
    withCredentials: false
});

const unauthenticated_api = axios.create({
    baseURL: API_BASE_URL
});

api.interceptors.request.use(
    (config) => {
        // Use the authToken from module scope instead of localStorage
        if (authToken) {
            config.headers.Authorization = `Bearer ${authToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export { api, unauthenticated_api }; 
import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api',
    withCredentials: true
});

const unauthenticated_api = axios.create({
    baseURL: API_BASE_URL
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export { api, unauthenticated_api }; 
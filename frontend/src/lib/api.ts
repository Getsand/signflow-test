/**
 * API Client
 * 
 * Axios instance configured for backend API calls.
 * Automatically adds JWT token to requests and handles errors.
 */

import axios, { AxiosError } from 'axios';

// Base API URL - Update this to match your backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - Add JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      
      if (status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }

      // Extract error message from response
      const errorData = error.response.data as { detail?: string; message?: string };
      const message = errorData?.detail || errorData?.message || 'An error occurred';
      
      return Promise.reject(new Error(message));
    } else if (error.request) {
      // Request made but no response received
      return Promise.reject(new Error('Network error. Please check your connection.'));
    } else {
      // Something else happened
      return Promise.reject(new Error('An unexpected error occurred'));
    }
  }
);

export default api;


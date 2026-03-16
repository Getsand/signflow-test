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

      // Extract error message (backend may return detail as string or FastAPI validation array)
      const errorData = error.response.data as { detail?: string | Array<{ msg?: string; loc?: unknown }>; message?: string };
      let message = errorData?.message || 'An error occurred';
      if (errorData?.detail != null) {
        if (typeof errorData.detail === 'string') {
          message = errorData.detail;
        } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
          const first = errorData.detail[0];
          message = (first && typeof first.msg === 'string') ? first.msg : String(errorData.detail[0]);
        } else if (typeof errorData.detail === 'object') {
          message = (errorData.detail as { message?: string }).message || JSON.stringify(errorData.detail);
        }
      }
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


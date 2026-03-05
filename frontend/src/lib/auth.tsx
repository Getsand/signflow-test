/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Manages JWT token storage and user session.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from './api';
import { User, AuthContextType, LoginResponse, RegisterResponse } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          
          // Verify token is still valid by fetching current user
          try {
            const response = await api.get<User>('/api/v1/auth/me');
            setUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data));
          } catch (error) {
            // Token invalid, clear auth state
            console.error('Token validation failed:', error);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('user');
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Login user with email and password
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await api.post<LoginResponse>('/api/v1/auth/login', {
        email,
        password,
      });

      const { access_token } = response.data;

      // Store token
      localStorage.setItem('access_token', access_token);
      setToken(access_token);

      // Fetch user details
      const userResponse = await api.get<User>('/api/v1/auth/me');
      const userData = userResponse.data;

      // Store user
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      // Re-throw error to be handled by the component
      throw error;
    }
  };

  /**
   * Register new user
   */
  const register = async (email: string, password: string, name?: string): Promise<void> => {
    try {
      // Register user
      await api.post<RegisterResponse>('/api/v1/auth/register', {
        email,
        password,
        name,
      });

      // Automatically log in after successful registration
      await login(email, password);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Logout user
   */
  const logout = (): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 * 
 * @example
 * const { user, login, logout, isAuthenticated } = useAuth();
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


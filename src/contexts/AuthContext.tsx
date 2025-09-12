import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'display-forecaster-auth';

// Simple hash function for password comparison (client-side only)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const authData = localStorage.getItem(AUTH_STORAGE_KEY);
        if (authData) {
          const { timestamp } = JSON.parse(authData);
          const now = Date.now();
          const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours

          if (now - timestamp < sessionDuration) {
            setIsAuthenticated(true);
          } else {
            // Session expired
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.warn('Error checking auth status:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = (username: string, password: string): boolean => {
    const correctUsername = import.meta.env.VITE_AUTH_USERNAME;
    const correctPassword = import.meta.env.VITE_AUTH_PASSWORD;

    if (!correctUsername || !correctPassword) {
      console.warn('Authentication credentials not configured');
      return false;
    }

    // Simple credential check
    const isValidUsername = username.trim().toLowerCase() === correctUsername.toLowerCase();
    const isValidPassword = password === correctPassword;

    if (isValidUsername && isValidPassword) {
      // Store authentication state with timestamp
      const authData = {
        authenticated: true,
        timestamp: Date.now(),
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      setIsAuthenticated(true);
      return true;
    }

    return false;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
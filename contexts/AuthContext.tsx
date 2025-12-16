import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiService } from '../services/apiService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  callApiWithAuth: <T>(apiCall: () => Promise<T>) => Promise<T>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const userString = localStorage.getItem('user');
        if (userString) {
          const parsed: User = JSON.parse(userString);
          setUser(parsed);
          if (parsed?.token) {
            apiService.setAuthToken(parsed.token);
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const loggedInUser = await apiService.login(username, password);
      if (loggedInUser?.token) {
        apiService.setAuthToken(loggedInUser.token);
      }

      let profile = null;
      try {
        profile = await apiService.getUserProfile();
      } catch (e) {
        // ignore profile fetch failures
      }

      const mergedUser: User = {
        ...loggedInUser,
        avatar_url: profile?.avatar_url || undefined,
      };

      localStorage.setItem('user', JSON.stringify(mergedUser));
      setUser(mergedUser);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      apiService.setAuthToken(null);
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('user');
  }, []);

  const callApiWithAuth = useCallback(async <T,>(apiCall: () => Promise<T>): Promise<T> => {
    try {
      return await apiCall();
    } catch (error: any) {
      if (error && error.message === 'Token expired') {
        console.log('AUTH: Access token expired. Attempting refresh...');
        const userString = localStorage.getItem('user');
        const currentUser: User | null = userString ? JSON.parse(userString) : null;
        if (!currentUser?.refreshToken) {
          console.error('AUTH: No refresh token available. Logging out.');
          logout();
          throw new Error('Session expired. Please log in again.');
        }

        try {
          const { token: newAccessToken } = await apiService.refreshToken(currentUser.refreshToken);
          const updatedUser = { ...currentUser, token: newAccessToken } as User;
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
          try {
            apiService.setAuthToken(newAccessToken);
          } catch (e) {
            // ignore
          }
          console.log('AUTH: Token refreshed successfully. Retrying the original API call.');
          return await apiCall();
        } catch (refreshError) {
          console.error('AUTH: Refresh token is invalid or expired. Logging out.', refreshError);
          try {
            apiService.setAuthToken(null);
          } catch (e) {
            // ignore
          }
          logout();
          throw new Error('Session expired. Please log in again.');
        }
      }
      throw error;
    }
  }, [logout]);

  const refreshUserProfile = useCallback(async () => {
    if (!user) return;
    try {
      const profile = await apiService.getUserProfile();
      const mergedUser: User = { ...user, avatar_url: profile?.avatar_url || undefined };
      setUser(mergedUser);
      localStorage.setItem('user', JSON.stringify(mergedUser));
    } catch (e) {
      // ignore
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, callApiWithAuth, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

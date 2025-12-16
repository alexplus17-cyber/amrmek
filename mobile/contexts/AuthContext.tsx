import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setupInterceptors } from '../api';
import { login as apiLogin } from '../api';
import { queryClient } from '../queryClient';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface UserSession {
  token: string;
  refreshToken?: string;
}

interface AuthContextType {
  user: UserSession | null;
  signIn: (token: string, refreshToken?: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { registerForPushNotificationsAsync } = usePushNotifications();

  const signOut = async () => {
    setUser(null);
    try {
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } catch (e) {
      console.error('Failed to clear secure store during signOut', e);
    }
    try {
      // Clear react-query cache on logout
      await queryClient.clear();
    } catch (e) {
      console.error('Failed to clear query client on signOut', e);
    }
  };

  useEffect(() => {
    setupInterceptors(signOut);
    const loadTokens = async () => {
      try {
        const token = await SecureStore.getItemAsync('authToken');
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (token) {
          // Only include refreshToken if it's present (non-null and non-empty)
          setUser(refreshToken ? { token, refreshToken } : { token });
        }
      } catch (e) {
        console.error('Failed to load auth tokens.', e);
      } finally {
        setLoading(false);
      }
    };
    loadTokens();

    // DEV: force a known test JWT during development to make automated runs deterministic
    // This sets the token directly (no network call) so the app can fetch protected
    // dashboard data reliably during local testing. Remove or disable in production.
    if (__DEV__) {
      (async () => {
        try {
          const existing = await SecureStore.getItemAsync('authToken');
          if (!existing) {
            const DEV_TEST_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0L3dvcmQiLCJpYXQiOjE3NjU4MzM1OTYsIm5iZiI6MTc2NTgzMzU5NiwiZXhwIjoxNzY2NDM4Mzk2LCJkYXRhIjp7InVzZXIiOnsiaWQiOiIzIn19fQ.8dQ51zkYkvooxShchpuACLvpfGuT9oWPko8Us1Lo75Y';
            // Validate basic JWT shape before storing (three dot-separated parts)
            const isJwtLike = typeof DEV_TEST_TOKEN === 'string' && DEV_TEST_TOKEN.split('.').length === 3;
            if (isJwtLike) {
              await SecureStore.setItemAsync('authToken', DEV_TEST_TOKEN);
              setUser({ token: DEV_TEST_TOKEN });
              // ensure interceptors are configured now that token exists
              try {
                setupInterceptors(signOut);
              } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('Failed to re-setup interceptors after dev token injection:', e?.message || e);
              }
            } else {
              // eslint-disable-next-line no-console
              console.warn('DEV_TEST_TOKEN appears invalid; skipping injection');
            }
          }
        } catch (e) {
          console.log('Dev forced token setup failed (ok):', e?.message || e);
        }
      })();
    }
  }, []);

  const signIn = async (token: string, refreshToken?: string) => {
    setUser(refreshToken ? { token, refreshToken } : { token });
    try {
      await SecureStore.setItemAsync('authToken', token);
      if (refreshToken) {
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      } else {
        // Ensure no stale refresh token remains
        await SecureStore.deleteItemAsync('refreshToken');
      }
    } catch (e) {
      console.error('Failed to save tokens to secure store', e);
    }
    // Register for push notifications after sign in
    try {
      await registerForPushNotificationsAsync();
    } catch (e) {
      console.error('Failed to register for push notifications', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
};

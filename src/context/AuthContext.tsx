import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/traccar';
import { traccarApi } from '../services/api';
import { traccarSocket } from '../services/socket';
import { APP_CONFIG } from '../constants/config';

interface AuthContextType {
  user: User | null;
  serverUrl: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithCredentials: (emailOrUrl: string, passOrEmail?: string, passOrRemember?: any, remember?: boolean) => Promise<void>;
  loginWithToken: (tokenOrUrl: string, tokenOrRemember?: any, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_KEYS = {
  SERVER_URL: 'gettrack_server_url',
  USER_DATA: 'gettrack_user',
  TOKEN: 'gettrack_token',
  CREDENTIALS: 'gettrack_credentials',
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [serverUrl, setServerUrl] = useState<string>(APP_CONFIG.SERVER_URL);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore stored session on mount
  useEffect(() => {
    async function loadSavedAuth() {
      try {
        let activeUrl = APP_CONFIG.SERVER_URL;
        if (APP_CONFIG.ALLOW_CUSTOMER_SERVER_CHANGE) {
          const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
          if (savedUrl) {
            activeUrl = savedUrl;
          }
        }
        setServerUrl(activeUrl);
        traccarApi.setServerUrl(activeUrl);

        const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const savedCredsJson = await AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS);

        if (savedToken) {
          try {
            const fetchedUser = await traccarApi.loginWithToken(savedToken);
            setUser(fetchedUser);
            traccarSocket.connect(activeUrl, null, savedToken);
          } catch (e) {
            console.warn('Auto login with token failed:', e);
          }
        } else if (savedCredsJson) {
          try {
            const { email, password } = JSON.parse(savedCredsJson);
            const fetchedUser = await traccarApi.loginWithCredentials(email, password);
            setUser(fetchedUser);
            traccarSocket.connect(activeUrl);
          } catch (e) {
            console.warn('Auto login with credentials failed:', e);
          }
        }
      } catch (err) {
        console.error('Failed to restore auth session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedAuth();
  }, []);

  const loginWithCredentials = async (
    arg1: string,
    arg2?: string,
    arg3?: any,
    arg4: boolean = true
  ) => {
    setIsLoading(true);
    try {
      // Flexible argument handling:
      // signature A: loginWithCredentials(email, password, remember?)
      // signature B: loginWithCredentials(url, email, password, remember?)
      let targetUrl = APP_CONFIG.SERVER_URL;
      let email = '';
      let pass = '';
      let remember = true;

      if (arg2 !== undefined && typeof arg3 === 'string') {
        // signature B
        targetUrl = APP_CONFIG.ALLOW_CUSTOMER_SERVER_CHANGE ? arg1 : APP_CONFIG.SERVER_URL;
        email = arg2;
        pass = arg3;
        remember = arg4 !== undefined ? arg4 : true;
      } else {
        // signature A
        targetUrl = APP_CONFIG.SERVER_URL;
        email = arg1;
        pass = arg2 || '';
        remember = arg3 !== undefined ? !!arg3 : true;
      }

      traccarApi.setServerUrl(targetUrl);
      setServerUrl(targetUrl);

      const loggedInUser = await traccarApi.loginWithCredentials(email, pass);
      setUser(loggedInUser);

      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, targetUrl);

      if (remember) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.CREDENTIALS,
          JSON.stringify({ email, password: pass })
        );
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
      }

      // Fetch session token for WebSocket connection
      let sessionToken = '';
      try {
        sessionToken = await traccarApi.getSessionToken();
      } catch {}

      // Connect real-time socket
      traccarSocket.connect(targetUrl, null, sessionToken);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithToken = async (
    arg1: string,
    arg2?: any,
    arg3: boolean = true
  ) => {
    setIsLoading(true);
    try {
      let targetUrl = APP_CONFIG.SERVER_URL;
      let token = '';
      let remember = true;

      if (typeof arg2 === 'string') {
        targetUrl = APP_CONFIG.ALLOW_CUSTOMER_SERVER_CHANGE ? arg1 : APP_CONFIG.SERVER_URL;
        token = arg2;
        remember = arg3 !== undefined ? arg3 : true;
      } else {
        targetUrl = APP_CONFIG.SERVER_URL;
        token = arg1;
        remember = arg2 !== undefined ? !!arg2 : true;
      }

      traccarApi.setServerUrl(targetUrl);
      setServerUrl(targetUrl);

      const loggedInUser = await traccarApi.loginWithToken(token);
      setUser(loggedInUser);

      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, targetUrl);

      if (remember) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      }

      // Connect socket
      traccarSocket.connect(targetUrl, null, token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await traccarApi.logout();
    } catch {}
    traccarSocket.disconnect();
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        serverUrl,
        isAuthenticated: !!user,
        isLoading,
        loginWithCredentials,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


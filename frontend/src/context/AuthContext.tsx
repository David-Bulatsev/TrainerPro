import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { api, setApiToken } from "../lib/api";
import type { ApiUser } from "../types/api";

type AuthContextValue = {
  user: ApiUser | null;
  token: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("authToken"));
  const [user, setUser] = useState<ApiUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const persistSession = (nextToken: string, nextUser: ApiUser) => {
    setToken(nextToken);
    localStorage.setItem("authToken", nextToken);
    setApiToken(nextToken);
    setUser(nextUser);
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    setApiToken(null);
    localStorage.removeItem("authToken");
  };

  const authenticate = async (email: string, password: string) => {
    setApiToken(null);
    const { access_token } = await api.login({ email, password });
    setApiToken(access_token);

    try {
      const profile = await api.getCurrentUser();
      persistSession(access_token, profile);
    } catch (error) {
      clearSession();
      throw error;
    }
  };

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      if (!token) {
        setApiToken(null);
        setUser(null);
        setInitializing(false);
        return;
      }

      setApiToken(token);
      try {
        const profile = await api.getCurrentUser();
        if (!ignore) {
          setUser(profile);
        }
      } catch (error) {
        console.error("Failed to restore session", error);
        if (!ignore) {
          clearSession();
        }
      } finally {
        if (!ignore) {
          setInitializing(false);
        }
      }
    }

    bootstrap();
    return () => {
      ignore = true;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    await authenticate(email, password);
  };

  const register = async (email: string, password: string, fullName?: string) => {
    setApiToken(null);
    await api.register({ email, password, full_name: fullName });
    await authenticate(email, password);
  };

  const logout = () => {
    clearSession();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initializing,
      login,
      register,
      logout,
    }),
    [user, token, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiLogin, apiRegister, apiMe, saveToken, getToken, clearToken, type User } from "@/src/lib/auth";

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUserFromExternal: (user: User | null) => void;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore token + fetch /me
  useEffect(() => {
    (async () => {
      try {
        const stored = await getToken();
        if (!stored) {
          setLoading(false);
          return;
        }
        setToken(stored);
        try {
          const u = await apiMe(stored);
          setUser(u);
        } catch {
          await clearToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: t, user: u } = await apiLogin(email, password);
    await saveToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const { token: t, user: u } = await apiRegister(email, password);
    await saveToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, register, logout, setUserFromExternal: setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

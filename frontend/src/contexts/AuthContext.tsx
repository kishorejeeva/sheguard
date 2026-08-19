import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { connectSocket, disconnectSocket } from "../services/socket";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: "WEARER" | "GUARDIAN";
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("sheguard_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("sheguard_token"));

  useEffect(() => {
    if (token) connectSocket(token);
    return () => disconnectSocket();
  }, [token]);

  function login(newToken: string, newUser: AuthUser) {
    localStorage.setItem("sheguard_token", newToken);
    localStorage.setItem("sheguard_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem("sheguard_token");
    localStorage.removeItem("sheguard_user");
    disconnectSocket();
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

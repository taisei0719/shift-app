"use client";

import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

interface UserInfo {
  user_name: string;
  role: "admin" | "staff";
  shop_name?: string;
  email?: string;
  shop_id?: number | null;
}

interface UserContextType {
  user: UserInfo | null;
  refreshUser: () => Promise<void>;
  setUser: (userData: UserInfo | null) => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  refreshUser: async () => {},
  setUser: () => {},
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);

  const refreshUser = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/session", { withCredentials: true });
      setUser(res.data.user || null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, refreshUser, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

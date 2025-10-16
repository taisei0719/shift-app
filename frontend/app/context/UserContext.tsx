//app/context/UserContext.tsx

"use client";

import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

// ★ 修正: shop_request_code を UserInfo に追加
interface UserInfo {
  user_id: number;
  user_name: string;
  role: "admin" | "staff";
  shop_name?: string | null; // shop_name は null の可能性もあるため | null を追加
  email?: string; // サーバーレスポンスに含まれていないが、将来のために残しておく
  shop_id?: number | null; // null の可能性もあるため | null を追加
  shop_request_code?: string | null; // ★ 新規追加: リクエスト中の店舗コード
}

interface UserContextType {
  user: UserInfo | null;
  refreshUser: () => Promise<void>;
  setUser: (userData: UserInfo | null) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  refreshUser: async () => {},
  setUser: () => {},
  loading: true,
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Axios インスタンスを直接使用し、baseUrlを設定した api.ts を使う方がより堅牢だが、
  // ここでは提供コードに合わせて axios を直接使用する。
  const refreshUser = async () => {
    try {
      // セッション情報を取得
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/session`, { withCredentials: true });
      
      const userData = res.data.user;

      if (userData) {
        // ★ 修正: サーバーから返された全データ（shop_request_codeを含む）をセット
        // userData に shop_request_code が含まれていることを前提とする
        setUser(userData as UserInfo);
      } else {
        setUser(null);
      }
      
    } catch (error) {
      console.error("Failed to refresh user session:", error);
      setUser(null);
    } finally {
      setLoading(false); // ★ 読み込み完了時にfalseを設定！
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, refreshUser, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

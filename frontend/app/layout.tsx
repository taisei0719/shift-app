"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserProvider } from "./context/UserContext";
import axios from "axios";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();

  const handleLogout = async () => {
    await axios.post("http://localhost:5000/api/logout", {}, { withCredentials: true });
    window.location.href = "/";
  };

  return (
    <html lang="ja">
      <head>
        <title>シフト管理システム</title>
      </head>
      <body>
        <div className="sidebar">
          {user ? (
            <>
              <div className="user-info">
                <p>
                  <strong>ログイン中:</strong>
                </p>
                <p>{user.user_name}</p>
                <p>役割: {user.role}</p>
                <p>所属店舗: {user.shop_name || "未登録"}</p>
              </div>

              <div className="nav-links">
                {user.role === "admin" ? (
                  <>
                    <Link href="/admin">カレンダー</Link>
                    <Link href="/admin/day/today">シフト確認</Link>
                    <Link href="/shop_register">店舗登録</Link>
                    <Link href="/edit_account">アカウント</Link>
                    <Link href="/shop/detail">店舗詳細</Link>
                  </>
                ) : (
                  <>
                    <Link href="/staff">スタッフトップ</Link>
                    <Link href="/shift_input">シフト提出</Link>
                    <Link href="/shop_register">店舗登録</Link>
                    <Link href="/edit_account">アカウント</Link>
                    <Link href={`/shop/${user.shop_name || "unknown"}`}>店舗詳細</Link>
                  </>
                )}
              </div>

              <button onClick={handleLogout} className="logout-btn">
                ログアウト
              </button>
            </>
          ) : (
            <div className="not-logged-in">
              <p>未ログイン</p>
              {pathname !== "/" && <Link href="/">ログイン</Link>}
            </div>
          )}
        </div>

        <div className="main-content">
          <div className="header">シフト管理システム</div>
          {children}
        </div>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <title>シフト管理システム</title>
      </head>
      <body>
        <UserProvider>
          <LayoutContent>{children}</LayoutContent>
        </UserProvider>
      </body>
    </html>
  );
}

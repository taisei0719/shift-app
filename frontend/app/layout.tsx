"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import axios from "axios";

interface UserInfo {
  user_name: string;
  role: "admin" | "staff";
  shop_name?: string;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Flask セッション情報を取得
    axios
      .get("http://localhost:5000/api/session", { withCredentials: true })
      .then((res) => {
        setUser(res.data.user || null);
      })
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await axios.post("http://localhost:5000/api/logout", {}, { withCredentials: true });
    window.location.href = "/login";
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
                    <Link href="/shop/register">店舗登録</Link>
                    <Link href="/account/edit">アカウント</Link>
                    {/* 店舗詳細は動的リンク */}
                    <Link href="/shop/detail">店舗詳細</Link>
                  </>
                ) : (
                  <>
                    <Link href="/staff">スタッフトップ</Link>
                    <Link href="/shift/input">シフト提出</Link>
                    <Link href="/staff/shop_register">店舗登録</Link>
                    <Link href="/account/edit">アカウント</Link>
                    <Link href="/shop/detail">店舗詳細</Link>
                  </>
                )}
              </div>

              <button onClick={handleLogout} classNam

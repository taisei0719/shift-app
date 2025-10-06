// frontend/components/Layout.js
import React from "react";
import Link from "next/link";

export default function Layout({ user, children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: "row" }}>
      {/* サイドバー */}
      <div className="sidebar">
        {user ? (
          <>
            <div className="user-info">
              <p><strong>ログイン中:</strong></p>
              <p>{user.name}</p>
              <p>役割: {user.role}</p>
              <p>所属店舗: {user.shop_name || "-"}</p>
            </div>
            <div className="nav-links">
              {user.role === "admin" ? (
                <>
                  <Link href="/admin">カレンダー</Link>
                  <Link href="/admin_day">シフト確認</Link>
                  <Link href="/shop_register">店舗登録</Link>
                  <Link href="/edit_account">アカウント</Link>
                </>
              ) : (
                <>
                  <Link href="/staff">スタッフトップ</Link>
                  <Link href="/shift_input">シフト提出</Link>
                  <Link href="/staff_shop_register">店舗登録</Link>
                  <Link href="/edit_account">アカウント</Link>
                </>
              )}
            </div>
            <form method="post" action="/logout" style={{ marginTop: 20 }}>
              <button type="submit" className="logout-btn">ログアウト</button>
            </form>
          </>
        ) : (
          <>
            <p>未ログイン</p>
            <Link href="/login">ログイン</Link>
          </>
        )}
      </div>

      {/* メインコンテンツ */}
      <div className="main-content">
        <div className="header">{user ? `${user.name}の画面` : "シフト管理システム"}</div>
        {children}
      </div>
    </div>
  );
}


// frontend/app/layout.tsx

"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserProvider } from "./context/UserContext";
import axios from "axios";

// nav-link に相当するクラスを定義
const NavLinkClasses = "text-white py-2 px-3 rounded-lg font-medium transition-colors duration-200 lg:hover:bg-indigo-600 lg:active:bg-indigo-800 text-center text-xs lg:text-base flex-1 lg:flex-none";
// モバイルで非表示にするクラス
const HiddenOnMobile = "hidden lg:block";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();

  const handleLogout = async () => {
    await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/logout`, {}, { withCredentials: true });
    window.location.href = "/";
  };

  // 全体のコンテナをflexにし、背景色を設定
  return (
    <div className="flex min-h-screen bg-gray-50">
        {/*サイドバーのモダン化*/}
        <div className="flex flex-col w-64 min-w-[256px] bg-indigo-700 text-white p-6 shadow-2xl z-10 transition-all duration-300 fixed bottom-0 left-0 right-0 h-16 lg:h-auto lg:relative lg:flex-col lg:justify-start lg:shadow-none">
          {user ? (
            <>
              {/* ユーザー情報 (モバイルでは非表示) */}
              <div className="user-info mb-8 hidden lg:block">
                <p className="text-lg font-bold">
                  ログイン中:
                </p>
                <p className="text-xl font-extrabold mt-1">{user.user_name}</p>
                <p className="text-sm mt-1">役割: {user.role === "admin" ? "オーナー" : "スタッフ"}</p>
                <p className="text-sm mt-1">店舗: {user.shop_name || "未登録"}</p>
              </div>

              {/* ナビゲーションリンク (PCとモバイルで表示を切り替え) */}
              <div className="nav-links flex flex-row space-x-4 lg:flex-col lg:space-x-0 lg:space-y-3 w-full lg:flex-1 lg:overflow-y-auto">
                {user.role === "admin" ? (
                  <>
                    <Link href="/admin" className={NavLinkClasses}>カレンダー</Link>
                    <Link href="/shop_register" className={`${NavLinkClasses} ${HiddenOnMobile}`}>店舗登録</Link>
                    <Link href="/edit_account" className={NavLinkClasses}>アカウント</Link>
                    <Link href={`/shop/${user.shop_id || "unknown"}`} className={NavLinkClasses}>店舗詳細</Link>
                    <Link href={`/shop/${user.shop_id || "unknown"}/users`} className={`${NavLinkClasses} ${HiddenOnMobile}`}>従業員一覧</Link>
                    <Link href="/admin/join_requests" className={`${NavLinkClasses} ${HiddenOnMobile}`}>参加リクエスト</Link>
                  </>
                ) : (
                  <>
                    <Link href="/staff" className={NavLinkClasses}>スタッフトップ</Link>
                    <Link href="/staff_shop_register" className={`${NavLinkClasses} ${HiddenOnMobile}`}>店舗登録</Link>
                    <Link href="/edit_account" className={NavLinkClasses}>アカウント</Link>
                    <Link href={`/shop/${user.shop_id || "unknown"}`} className={NavLinkClasses}>店舗詳細</Link>
                    <Link href={`/shop/${user.shop_id || "unknown"}/users`} className={`${NavLinkClasses} ${HiddenOnMobile}`}>従業員一覧</Link>
                  </>
                )}

                {/* モバイルログアウトボタンをナビバー内に配置 */}
                <button 
                    onClick={handleLogout} 
                    className="flex-1 py-2 px-4 text-xs font-semibold bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-lg text-white transition-colors duration-200 lg:hidden">
                    ログアウト
                </button>
              </div>

              {/* ログアウトボタン (モバイルでは非表示、PCでは下部に固定) */}
              <button 
                onClick={handleLogout} 
                className="mt-auto py-2 px-4 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 rounded-full text-white font-semibold shadow-md transition-colors duration-200 hidden lg:block">
                ログアウト
              </button>
            </>
          ) : (
            <div className="not-logged-in text-center flex-1 flex flex-col justify-center">
              <p className="text-lg font-bold">未ログイン</p>
              {pathname !== "/" && <Link href="/" className="mt-4 text-indigo-200 hover:text-white underline">ログイン</Link>}
            </div>
          )}
        </div>

        {/* メインコンテンツ*/}
        <div className="main-content flex-1 flex flex-col items-center p-4 lg:p-8">
            
            {/* 共通ヘッダー */}
            <div className="w-full max-w-6xl py-4 px-6 mb-8 text-2xl font-bold text-center text-indigo-700 bg-white rounded-xl shadow-lg">
                BestShift
            </div>
            
            <div className="w-full max-w-6xl pb-20 lg:pb-0">
                {children}
            </div>
        </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="font-[Arial,sans-serif]">
      <head>
        <title>BestShift</title>
      </head>
      <body>
        <UserProvider>
          <LayoutContent>{children}</LayoutContent>
        </UserProvider>
      </body>
    </html>
  );
}
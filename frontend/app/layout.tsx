// frontend/app/layout.tsx

"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useUser, UserProvider } from "./context/UserContext";
import { api, TOKEN_STORAGE_KEY } from "@/lib/api";

interface MyShop {
  shop_id: number;
  name: string;
  is_active: boolean;
}

// nav-link に相当するクラスを定義
const NavLinkClasses = "text-white py-2 px-3 rounded-lg font-medium transition-colors duration-200 lg:hover:bg-indigo-600 lg:active:bg-indigo-800 text-center text-xs lg:text-base flex-1 lg:flex-none";
// モバイルで非表示にするクラス
const HiddenOnMobile = "hidden lg:block";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useUser();
  const pathname = usePathname();
  const [myShops, setMyShops] = useState<MyShop[]>([]);
  const [switching, setSwitching] = useState(false);

  const fetchMyShops = useCallback(async () => {
    if (!user) {
      setMyShops([]);
      return;
    }
    try {
      const res = await api.get("/my_shops");
      setMyShops(res.data.shops ?? []);
    } catch (err) {
      console.error("Failed to fetch my shops:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchMyShops();
  }, [fetchMyShops]);

  const handleSwitchShop = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextShopId = Number(e.target.value);
    if (!nextShopId || nextShopId === user?.shop_id) return;

    setSwitching(true);
    try {
      await api.post("/active_shop", { shop_id: nextShopId });
      await refreshUser();
      await fetchMyShops();
    } catch (err) {
      console.error("Failed to switch active shop:", err);
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = async () => {
    await api.post("/logout");
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.location.href = "/";
  };

  // 全体のコンテナをflexにし、背景色を設定
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
        {/*サイドバーのモダン化*/}
        <div className="flex flex-col w-full lg:w-64 lg:min-w-[256px] bg-indigo-700 text-white p-6 shadow-2xl z-10 transition-all duration-300 fixed bottom-0 left-0 right-0 h-16 lg:h-auto lg:relative lg:flex-col lg:justify-start lg:shadow-none lg:fixed-none lg:bottom-auto lg:left-auto lg:right-auto">
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
                {myShops.length > 1 && (
                  <div className="mt-2">
                    <label htmlFor="shop-switcher" className="text-xs text-indigo-200">
                      アクティブ店舗を切替
                    </label>
                    <select
                      id="shop-switcher"
                      value={user.shop_id ?? ""}
                      onChange={handleSwitchShop}
                      disabled={switching}
                      className="mt-1 w-full text-sm rounded-lg border border-indigo-300 bg-white text-gray-900 px-2 py-1.5 disabled:opacity-60"
                    >
                      {myShops.map((shop) => (
                        <option key={shop.shop_id} value={shop.shop_id}>
                          {shop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
// frontend/app/layout.tsx

"use client";

import "./globals.css"; // globals.cssは残すが、カスタムCSSは空にするのが理想
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserProvider } from "./context/UserContext";
import axios from "axios";

// ヘッダーやナビゲーションは、UserProviderの子としてLayoutContentに分離
function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser(); // loadingステータスも使用
  const pathname = usePathname();

  const handleLogout = async () => {
    // API呼び出しは、以前のセッション修正を考慮した形でOK
    await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/logout`, {}, { withCredentials: true });
    window.location.href = "/";
  };
  
  // ユーザー情報取得中はローディング表示
  if (loading) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-gray-50">
              <p className="text-xl text-indigo-700">読み込み中やで...</p>
          </div>
      );
  }

  // ★ 修正: 全体のレイアウトをTailwindで定義 ★
  return (
    // 画面全体のコンテナ: 最低高、Flex配置、淡い背景色
    <div className="min-h-screen flex bg-gray-50">
        
        {/* サイドバー（ログイン状態によって表示） */}
        {user && (
            // w-64: 幅を少し広げた | bg-indigo-800: 少し濃いめのプライマリカラー | shadow-2xl: 強い影
            <div className="w-64 bg-indigo-700 text-white p-6 flex flex-col shadow-2xl">
              
              {/* ユーザー情報エリア */}
              <div className="mb-8 border-b border-indigo-500 pb-4">
                {/* ログイン中: を強調 */}
                <p className="mb-1 text-base text-indigo-200">ログイン中:</p>
                <p className="text-xl font-extrabold truncate">{user.user_name}</p> {/* truncateで長い名前も対応 */}
                <p className="text-sm mt-1">役割: <span className="font-semibold">{user.role}</span></p>
                <p className="text-sm">所属店舗: <span className="font-semibold">{user.shop_name || "未登録"}</span></p>
              </div>

              {/* ナビゲーションリンク */}
              <div className="nav-links space-y-1 flex-1"> {/* flex-1でリンクエリアを拡大 */}
                {/* Linkコンポーネントの共通スタイルを定義 */}
                { user.role === "admin" ? (
                  <>
                    {/* ★ リンクのモダン化: hoverで色と背景が変わり、丸みを帯びる ★ */}
                    <Link href="/admin" className="nav-item">カレンダー</Link>
                    <Link href="/admin/day/today" className="nav-item">シフト確認</Link>
                    <Link href="/shop_register" className="nav-item">店舗登録</Link>
                    <Link href="/edit_account" className="nav-item">アカウント</Link>
                    <Link href={`/shop/${user.shop_id || "unknown"}`} className="nav-item">店舗詳細</Link>
                    <Link href="/admin/join_requests" className="nav-item">参加リクエスト</Link>
                  </>
                ) : (
                  <>
                    <Link href="/staff" className="nav-item">スタッフトップ</Link>
                    <Link href="/shifts" className="nav-item">シフト提出</Link> {/* /shifts に修正 */}
                    <Link href="/staff_shop_register" className="nav-item">店舗登録</Link>
                    <Link href="/edit_account" className="nav-item">アカウント</Link>
                    <Link href={`/shop/${user.shop_id || "unknown"}`} className="nav-item">店舗詳細</Link>
                  </>
                )}
              </div>

              {/* ログアウトボタンのモダン化: mt-autoで最下部に固定 */}
              <button 
                onClick={handleLogout} 
                className="mt-auto py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-md font-semibold"
              >
                ログアウト
              </button>
            </div>
        )}

        {/* メインコンテンツエリア */}
        <div className="flex-1 p-8 overflow-y-auto">
          
          {/* 共通ヘッダーのモダン化 */}
          <div className="text-3xl font-extrabold text-gray-900 mb-8 border-b border-gray-200 pb-4">
            シフト管理システム
          </div>
          
          {/* ログインしていない場合の表示 */}
          {!user && (
            <div className="not-logged-in p-4 text-center bg-white rounded-xl shadow-lg max-w-sm mx-auto mt-20">
                <p className="text-lg mb-4 font-semibold text-gray-700">ログインしてへんで</p>
                {pathname !== "/" && (
                    <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-medium transition">
                        ログイン画面へ
                    </Link>
                )}
            </div>
          )}
          
          {/* Children (各ページの内容) */}
          {children}
        </div>
    </div>
  );
}

// Global Nav Item Style (Linkコンポーネントに適用するためのユーティリティコンポーネント)
const NavItem = ({ href, children, isActive }: { href: string, children: React.ReactNode, isActive: boolean }) => {
    return (
        <Link 
            href={href} 
            className={`block py-2 px-3 rounded-lg transition text-sm font-medium 
                ${isActive 
                    ? 'bg-indigo-600 text-white shadow-md' // アクティブなリンク
                    : 'hover:bg-indigo-600 text-indigo-100' // 非アクティブなリンク
                }`}
        >
            {children}
        </Link>
    );
};


// RootLayoutは変更なし
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      {/* <head>タグの中身はNext.jsが処理するので、不要な場合は削除 */}
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
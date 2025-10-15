// frontend/app/layout.tsx

"use client";

import "./globals.css";
import Link from "next/link";
// ★ 追加: useRouter と useEffect
import { usePathname, useRouter } from "next/navigation"; 
import { useUser, UserProvider } from "./context/UserContext";
import axios from "axios";
import { useEffect } from "react"; 

// 役割別ナビゲーションリンクのパス定義 (既存のパスを調整)
const staffNavLinks = [
    { href: "/staff/shifts", label: "シフト提出" }, // スタッフのトップはシフトページ
    { href: "/staff_shop_register", label: "店舗参加" },
    { href: "/edit_account", label: "アカウント" },
    // { href: `/shop/unknown`, label: "店舗詳細" }, // shop_idがない場合があるので一旦不明なURLは削除
];

const adminNavLinks = [
    { href: "/admin", label: "カレンダー" },
    { href: "/admin/day/today", label: "シフト確認" },
    { href: "/shop_register", label: "店舗登録" },
    { href: "/admin/join_requests", label: "参加リクエスト" },
    { href: "/edit_account", label: "アカウント" },
    // { href: `/shop/unknown`, label: "店舗詳細" },
];


function LayoutContent({ children }: { children: React.ReactNode }) {
    // ★ 追加: loading, useRouter
    const { user, loading } = useUser();
    const pathname = usePathname();
    const router = useRouter(); 

    const handleLogout = async () => {
        await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/logout`, {}, { withCredentials: true });
        window.location.href = "/";
    };

    // =======================================================
    // ★ 認証と認可のルーティング制御 (最重要修正箇所)
    // =======================================================
    useEffect(() => {
        if (loading) return;

        const isPublicPath = pathname === "/" || pathname === "/register";
        
        // 1. 未ログイン時の制御
        if (!user) {
            if (!isPublicPath) {
                // 公開ページ以外にいたらログインページにリダイレクト
                router.replace("/");
            }
            return;
        }

        // 2. ログイン済みの制御 (トップページの誘導と役割チェック)
        const userRole = user.role;
        const targetPath = userRole === "admin" ? "/admin" : "/staff/shifts";

        if (pathname === "/") {
            // ログイン後に '/' にアクセスしたら役割別トップへリダイレクト
            router.replace(targetPath);
            return;
        }
        
        // 3. 役割（ロール）に基づくアクセス制御
        
        // 管理者チェック
        if (userRole === "admin" && !pathname.startsWith("/admin") && pathname !== "/shop_register" && pathname !== "/edit_account") {
            // 例外的な許可 (/shop_register や /edit_account は許可)
            if (!pathname.startsWith("/shop/")) {
                 router.replace("/admin");
                 return;
            }
        }

        // スタッフチェック
        if (userRole === "staff" && !pathname.startsWith("/staff") && pathname !== "/staff_shop_register" && pathname !== "/edit_account") {
             // 例外的な許可
             if (!pathname.startsWith("/shop/")) {
                 router.replace("/staff/shifts"); 
                 return;
             }
        }

    }, [user, loading, pathname, router]);


    // ユーザー情報取得中はローディング表示 (リダイレクトを待つ間も含む)
    if (loading || (user && pathname === "/")) { 
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <p className="text-xl text-indigo-700">読み込み中...</p>
            </div>
        );
    }
    
    // 未ログインで公開ページにいる場合は、メインコンテンツのみを表示
    if (!user) {
        return (
            // main-content のみが中央に来るように調整 (globals.cssに依存)
            <div className="main-content flex-grow">
                {children}
            </div>
        );
    }

    // ログイン済みユーザー用のレイアウト
    return (
        // 既存のCSSクラス（globals.cssに定義されている前提）を使用
        <>
            <div className="sidebar">
                {/* ログイン中ユーザー情報 */}
                <div className="user-info">
                    <p><strong>ログイン中:</strong></p>
                    <p>{user.user_name}</p>
                    <p>役割: {user.role}</p>
                    <p>所属店舗: {user.shop_name || "未登録"}</p>
                </div>

                {/* ナビゲーションリンク */}
                <div className="nav-links">
                    {(user.role === "admin" ? adminNavLinks : staffNavLinks).map((item) => (
                        <Link 
                            key={item.href} 
                            href={item.href} 
                            // リンクのアクティブ状態を pathname.startsWith でチェック
                            // (TailwindのNavItemコンポーネントがないため、既存のCSSクラスに依存)
                            className={pathname.startsWith(item.href) && item.href !== "/" ? "active-link" : ""}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {/* ログアウトボタン */}
                <button onClick={handleLogout} className="logout-btn">
                    ログアウト
                </button>
            </div>

            <div className="main-content">
                <div className="header">シフト管理システム</div>
                {children}
            </div>
        </>
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

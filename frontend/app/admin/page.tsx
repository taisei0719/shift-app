// frontend/app/admin/page.tsx

"use client";

import React from "react";
import AdminCalendarWrapper from "./_AdminCalendarWrapper"; // 新しいラッパーをインポート
import { useUser } from "../context/UserContext";

export default function AdminPage() {
    const { user } = useUser();

    // ローディング中
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-600">ユーザー情報を読み込み中...</p>
            </div>
        );
    }

    // 店舗未所属の場合は店舗登録へ誘導
    if (user.shop_id === null) {
        return (
            <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
                <div className="w-full max-w-lg p-8 space-y-4 bg-white shadow-xl rounded-lg border border-gray-200 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">管理者トップ</h1>
                    <p className="text-red-500 font-medium border border-red-200 bg-red-50 p-3 rounded-md">
                        店舗がまだ登録されていません。
                    </p>
                    <p className="text-gray-600">
                        サイドバーの**「店舗登録」**から、新しい店舗を登録してください。
                    </p>
                </div>
            </div>
        );
    }

    // メインのシフト確認カレンダー表示
    return (
        <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
            <div className="w-full max-w-4xl px-4 md:px-8 space-y-6">
                <h1 className="text-3xl font-extrabold text-gray-900">
                    {user.shop_name || "店舗管理"} - シフト確認
                </h1>
                <p className="text-gray-600">
                    カレンダーから確認したい日をクリックしてください。
                </p>
                
                {/* Calendar Wrapper コンポーネントの配置 */}
                <AdminCalendarWrapper />
            </div>
        </div>
    );
}
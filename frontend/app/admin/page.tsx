// frontend/app/admin/page.tsx

"use client";

import React from "react";
// ★ 修正点: 共通の Calendar コンポーネントをインポート
import Calendar from "../../components/Calendar"; 
import { useUser } from "../context/UserContext";

export default function AdminPage() {
    const { user } = useUser();

    // 店舗未所属の場合は店舗登録へ誘導
    if (!user || user.shop_id === null) {
        return (
            <div className="admin-container">
                <h1>管理者トップ</h1>
                <p>店舗がまだ登録されていません。</p>
                <p>サイドバーの**「店舗登録」**から、新しい店舗を登録してください。</p>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <h1>{user.shop_name || "店舗管理"} - シフト確認</h1>
            <p>カレンダーから確認したい日をクリックしてください。</p>
            
            {/* ★ 修正点: 共通Calendarを配置。base_pathとcurrent_page_pathを渡す */}
            <Calendar 
                base_path="/admin/day" 
                current_page_path="/admin" // 月移動のリンク用
            />
        </div>
    );
}

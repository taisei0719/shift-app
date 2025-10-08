// frontend/app/staff/page.tsx

"use client";

import React from "react";
// ★ 修正点: 共通の Calendar コンポーネントをインポート
import Calendar from "../../components/Calendar"; 
import { useUser } from "../context/UserContext";

export default function StaffPage() {
    // ログイン中のユーザー情報を取得
    const { user } = useUser();
    
    // 店舗未所属の場合はカレンダーは表示せんと、店舗参加に誘導
    if (!user || user.shop_id === null) {
        return (
            <div className="staff-container">
                <h1>スタッフトップ</h1>
                <p>所属店舗がまだ登録されていません。</p>
                <p>サイドバーの**「店舗参加」**から、管理者にもらった店舗コードを入力してください。</p>
            </div>
        );
    }

    return (
        <div className="staff-container">
            <h1>{user.shop_name || "所属店舗なし"} のシフト提出</h1>
            <p>カレンダーから希望を提出したい日をクリックしてください。</p>
            
            {/* ★ 修正点: 共通Calendarを配置。base_pathとcurrent_page_pathを渡す */}
            <Calendar 
                base_path="/staff/shift_input" 
                current_page_path="/staff" // 月移動のリンク用
            />
        </div>
    );
}
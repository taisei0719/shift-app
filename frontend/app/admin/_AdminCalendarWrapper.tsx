// frontend/app/admin/_AdminCalendarWrapper.tsx (修正版)

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Calendar from "../../components/Calendar"; 
import { useUser } from "../context/UserContext";
import { api } from "@/lib/api"; // APIクライアントのインポート

// シフト状況の型定義
interface ShiftStatus {
    // 日付 (YYYY-MM-DD)
    date: string; 
    // 状況: 'no_requests' (希望なし), 'requested' (希望提出済/未確定), 'confirmed' (確定済)
    status: 'no_requests' | 'requested' | 'confirmed';
}

export default function AdminCalendarWrapper() {
    const searchParams = useSearchParams();
    // useUserからユーザーを取得
    const { user } = useUser(); 
    
    // URLから年/月を取得
    const now = new Date();
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    const [statusData, setStatusData] = useState<Record<string, ShiftStatus['status']>>({});
    // ローディング状態を初期値nullで開始し、userがロードされたかどうかを示す
    const [isLoading, setIsLoading] = useState<boolean | null>(null); 
    const [error, setError] = useState<string | null>(null);

    // 月のシフト状況を取得する関数
    // ★依存配列にuserを含める
    const fetchMonthlyStatus = useCallback(async (y: number, m: number, current_user: typeof user) => {
        // userがロード済みで、かつ店舗に所属していることを確認
        if (!current_user || current_user.shop_id === null) {
            setIsLoading(false); // データ取得の必要がないためローディングを終了
            return;
        }

        setIsLoading(true);
        setError(null);
        // setStatusData({}); // データの取得失敗時にクリアするため、ここでは不要

        try {
            // 例: /admin/shifts/status/2023/10 のようなエンドポイントを想定
            const res = await api.get(`/admin/shifts/status/${y}/${m}`);
            
            const dataMap: Record<string, ShiftStatus['status']> = {};
            // APIレスポンスを { 'YYYY-MM-DD': 'status' } の形式に変換
            if (res.data.monthly_status) {
                res.data.monthly_status.forEach((item: ShiftStatus) => {
                    dataMap[item.date] = item.status;
                });
            }
            setStatusData(dataMap);
        } catch (err: any) {
            console.error("シフト状況取得エラー:", err);
            setError(err.response?.data?.error || "シフト状況の取得に失敗しました。");
            setStatusData({}); // 失敗した場合はデータをクリア
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // userが取得されるまで待つ（`user`は`useUser`から提供される）
        if (user === undefined) {
            // Contextがまだユーザーのロード中であることを示す（AdminPageの`if (!user)`で処理されるはず）
            return; 
        }

        // ユーザー情報がロードされたらAPI呼び出し
        fetchMonthlyStatus(year, month, user);
    }, [year, month, user, fetchMonthlyStatus]); // ★userを依存配列に追加

    // 1. ユーザー情報のロード中
    if (user === undefined) { 
        return <div className="p-8 text-center text-indigo-600 font-semibold">ユーザー情報待機中...</div>;
    }

    // 2. ユーザー認証失敗 (userがnullの場合)
    //    ※AdminPage側で処理されているはずですが、念のため
    if (user === null) {
        return <div className="p-8 text-center text-red-600 font-semibold">認証情報が無効です。</div>;
    }
    // ↑ このチェックにより、これ以降 user は UserInfo 型として扱われます。

    // 3. APIローディング中
    if (isLoading) {
        return <div className="p-8 text-center text-indigo-600 font-semibold">シフト状況を読み込み中...</div>;
    }

    // 4. エラー表示
    if (error) {
         return <div className="p-4 text-center text-red-700 bg-red-100 border border-red-300 rounded-lg">エラー: {error}</div>;
    }
    
    // 5. 店舗未所属の場合
    //    userはUserInfo型に絞り込まれているため、このアクセスは安全です。
    if (user.shop_id === null) {
        // AdminPage側で店舗未所属のメッセージが表示されるため、ここでは null を返します。
        return null; 
    }
    
    // 6. 正常表示
    return (
        <Calendar 
            base_path="/admin/day" 
            current_page_path="/admin"
            statusData={statusData}
        />
    );
}
// frontend/app/admin/_AdminCalendarWrapper.tsx

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
    const { user } = useUser();
    
    // URLから年/月を取得
    const now = new Date();
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    const [statusData, setStatusData] = useState<Record<string, ShiftStatus['status']>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 月のシフト状況を取得する関数
    const fetchMonthlyStatus = useCallback(async (y: number, m: number) => {
        if (!user || !user.shop_id) return;

        setIsLoading(true);
        setError(null);
        setStatusData({});

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
            setError(err.response?.data?.error || "シフト状況の取得に失敗しました。");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchMonthlyStatus(year, month);
    }, [year, month, fetchMonthlyStatus]);

    if (isLoading) {
        return <div className="p-8 text-center text-indigo-600 font-semibold">シフト状況を読み込み中...</div>;
    }

    if (error) {
         return <div className="p-4 text-center text-red-700 bg-red-100 border border-red-300 rounded-lg">エラー: {error}</div>;
    }
    
    return (
        <Calendar 
            base_path="/admin/day" 
            current_page_path="/admin"
            statusData={statusData} // 状況データを Calendar に渡す
        />
    );
}
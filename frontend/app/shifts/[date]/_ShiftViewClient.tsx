//app/shifts/[date]/_ShiftViewClient.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUser } from "@/app/context/UserContext"; // 認証・ユーザー情報取得用

// -------------------- 型定義 --------------------
interface ConfirmedShiftData {
    id: number;
    user_id: number;
    shop_id: number;
    shift_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string; // HH:MM
    shift_type: 'confirmed';
    user_name: string;
}

// -------------------- ヘルパー関数 --------------------
// 前後の日付を計算する関数
const calculateDate = (currentDateStr: string, offset: number): string => {
    // タイムゾーンの問題を避けるため、一旦 'T00:00:00' を付加してDateオブジェクトを作成
    const current = new Date(`${currentDateStr}T00:00:00`);
    current.setDate(current.getDate() + offset);
    const year = current.getFullYear();
    const month = (current.getMonth() + 1).toString().padStart(2, '0');
    const day = current.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// -------------------- クライアントコンポーネント --------------------
export default function ShiftViewClient({ date }: { date: string }) {
    const { user, loading: userLoading } = useUser();
    const [shifts, setShifts] = useState<ConfirmedShiftData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const previousDate = calculateDate(date, -1);
    const nextDate = calculateDate(date, 1);

    // 確定シフトを取得する処理
    const fetchConfirmedShifts = useCallback(async () => {
        if (userLoading || !user) {
            // ユーザー情報がない場合は、認証エラーとして扱う
            if (!userLoading) {
                setError("認証が必要です。ログインしてください。");
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // ユーザー自身の確定シフトを取得するAPIを叩く
            const res = await api.get(`/shifts/${date}`);
            
            // APIは { confirmed_shifts: [...] } の形式を想定
            setShifts(res.data.confirmed_shifts || []);

        } catch (err: any) {
            const errorMessage = err.response?.data?.error || "確定シフトの取得に失敗しました。";
            setError(errorMessage);
            setShifts([]);
        } finally {
            setLoading(false);
        }
    }, [date, user, userLoading]);

    useEffect(() => {
        fetchConfirmedShifts();
    }, [fetchConfirmedShifts]);

    if (userLoading || loading) return <p style={{ padding: '20px' }}>シフト情報を読み込み中...</p>;
    if (error) return <p style={{ color: 'red', fontWeight: 'bold', padding: '20px' }}>エラー: {error}</p>;
    if (!user) return <p style={{ color: 'red', fontWeight: 'bold', padding: '20px' }}>認証されていません。ログインしてください。</p>;

    // --- レンダリング部分 ---
    return (
        <div className="staff-shift-view-page" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <Link href={`/shifts/${previousDate}`} style={{ textDecoration: 'none', color: '#0070f3' }}>
                    &lt; 前の日 ({previousDate})
                </Link>
                <h1 style={{ fontSize: '1.5em', color: '#333' }}>{user.name} さんの {date} の確定シフト</h1>
                <Link href={`/shifts/${nextDate}`} style={{ textDecoration: 'none', color: '#0070f3' }}>
                    次の日 ({nextDate}) &gt;
                </Link>
            </div>

            {shifts.length === 0 ? (
                <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f9f9f9' }}>
                    <p style={{ fontSize: '1.1em', color: '#555' }}>この日の確定シフトはありません。</p>
                </div>
            ) : (
                <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {shifts.map((shift, index) => (
                            <li 
                                key={index} 
                                style={{ 
                                    backgroundColor: '#e6f7ff', 
                                    padding: '15px', 
                                    marginBottom: '15px', 
                                    borderRadius: '6px',
                                    borderLeft: '5px solid #0070f3',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                <p style={{ margin: '0', fontWeight: 'bold', fontSize: '1.4em', color: '#005bb5' }}>
                                    {shift.start_time} - {shift.end_time}
                                </p>
                                <p style={{ margin: '5px 0 0', color: '#555', fontSize: '0.9em' }}>
                                    店舗ID: {shift.shop_id}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <p style={{ marginTop: '20px', fontSize: '0.9em', color: 'green', textAlign: 'center' }}>
                        上記が確定した勤務時間です。変更は管理者にご確認ください。
                    </p>
                </div>
            )}
            
            <Link href="/shifts" style={{ display: 'block', marginTop: '40px', textAlign: 'center', color: '#0070f3', textDecoration: 'underline' }}>
                カレンダーに戻る
            </Link>
        </div>
    );
}
// frontend/app/admin/page.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getMonth, getYear } from 'date-fns';
import Calendar from "../../components/Calendar"; 
import { useUser } from "../context/UserContext";

// ★ 追加: 型定義
interface ShiftData {
    id: number;
    shift_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    shift_type: 'request' | 'confirmed' | 'day_off';
    user_name: string; // 管理者ビューで必要
}

interface ShiftsByDate {
    [date: string]: ShiftData[]; 
}


export default function AdminPage() {
    const router = useRouter();
    // loadingもUserContextから取得 (未ログイン時のリダイレクトがより安全になる)
    const { user, loading } = useUser(); 
    
    // ユーザー情報取得中はローディング表示
    if (loading) {
        return <div className="admin-container"><h1>読み込み中...</h1></div>;
    }
    
    // 店舗未所属の場合は店舗登録へ誘導 (既存ロジックを維持)
    if (!user || user.shop_id === null) {
        return (
            <div className="admin-container">
                <h1>管理者トップ</h1>
                <p>店舗がまだ登録されていません。</p>
                <p>サイドバーの**「店舗登録」**から、新しい店舗を登録してください。</p>
            </div>
        );
    }

    // --- カレンダー表示ロジック (統合) ---
    
    // 初回表示の年月をクライアント側で取得
    const today = new Date();
    const initialYear = today.getFullYear();
    const initialMonth = today.getMonth() + 1; 

    // 表示する年月 (1-indexed)
    const [currentDate, setCurrentDate] = useState(new Date(initialYear, initialMonth - 1, 1));
    const currentYear = getYear(currentDate);
    const currentMonth = getMonth(currentDate) + 1; // 1-indexed

    const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // シフトデータの取得ロジック
    const fetchShifts = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        setError(null);
        
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            // 管理者用のAPIエンドポイントを想定
            const res = await fetch(`${baseUrl}/admin/shifts/month/${year}/${month}`, { 
                credentials: 'include' 
            });

            if (!res.ok) {
                throw new Error('管理者シフトデータの取得に失敗しました。');
            }

            const data = await res.json();
            
            // サーバーから返されたデータをShiftsByDate形式に変換
            const newShiftsByDate: ShiftsByDate = {};
            data.shifts.forEach((shift: ShiftData) => {
                if (!newShiftsByDate[shift.shift_date]) {
                    newShiftsByDate[shift.shift_date] = [];
                }
                newShiftsByDate[shift.shift_date].push(shift);
            });

            setShiftsByDate(newShiftsByDate);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'データの読み込み中にエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    // 初期ロードと月変更時のデータ取得
    useEffect(() => {
        // user.shop_idが確定してからデータを取得
        if (user && user.shop_id !== null) {
             fetchShifts(currentYear, currentMonth);
        }
    }, [currentYear, currentMonth, fetchShifts, user]);


    // Calendarコンポーネントに渡すためのシフトデータ形式への変換
    const calendarShiftData = useMemo(() => {
        const data: any = {};
        Object.entries(shiftsByDate).forEach(([date, shifts]) => {
            
            data[date] = {
                shifts: shifts.map(s => ({
                    start: s.start_time,
                    end: s.end_time,
                    type: s.shift_type,
                    user_name: s.user_name || 'スタッフ', // 管理者ビューで利用
                }))
            };
            
        });
        return data;
    }, [shiftsByDate]);


    // 月切り替えハンドラ
    const handleMonthChange = useCallback((year: number, month: number) => {
        setCurrentDate(new Date(year, month - 1, 1));
    }, []);


    // 日付クリックハンドラ
    const handleDateClick = useCallback((dateStr: string) => {
        // 管理者ビューではクリックで日別詳細ページへ遷移
        router.push(`/admin/day/${dateStr}`);
    }, [router]);
    
    // --- レンダー部分 ---

    if (error && !isLoading) {
        return <p className="text-red-500 text-center mt-8">エラー: {error}</p>;
    }
    
    if (isLoading) {
         return <div className="admin-container"><h1>{user.shop_name || "店舗管理"} - シフト確認</h1><p>シフトデータを読み込み中...</p></div>;
    }


    return (
        <div className="admin-container">
            <h1>{user.shop_name || "店舗管理"} - シフト確認</h1>
            <p>カレンダーから確認したい日をクリックしてください。（ロジックを統合しました）</p>
            
            {/* ★ 修正: 新しいPropsに合わせて Calendar コンポーネントを呼び出し ★ */}
            <Calendar 
                currentYear={currentYear}
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                onDateClick={handleDateClick}
                shiftsByDate={calendarShiftData}
                isAdminView={true} // 管理者ビューであることを伝える
            />
        </div>
    );
}

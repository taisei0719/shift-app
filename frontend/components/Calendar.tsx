// frontend/components/Calendar.tsx

"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

interface Day {
    day: number | "";
    month: number;
    dateStr: string;
}

interface CalendarProps {
    base_path: string; // 遷移先のベースパス (例: /admin/day)
    current_page_path: string; // 月移動用の現在のページパス (例: /admin)
    // ★追加: 日付ごとのシフト状況データ
    statusData?: Record<string, 'no_requests' | 'requested' | 'confirmed'>; 
}

// 曜日名
const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

export default function Calendar({ base_path, current_page_path, statusData = {} }: CalendarProps) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const now = new Date();
    // URLから年/月を取得 (パラメーターがない場合は現在の日付を使う)
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    // 前月・次月計算
    const prevDate = new Date(year, month - 2);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;

    const nextDate = new Date(year, month);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth() + 1;

    // カレンダーの自動生成ロジック
    const generateDays = (y: number, m: number): Day[] => {
        const firstDay = new Date(y, m - 1, 1);
        const lastDay = new Date(y, m, 0);
        const daysArray: Day[] = [];

        // 前月の日付の空欄を埋める (0=日, 1=月, ..., 6=土)
        let startDayOfWeek = firstDay.getDay();
        for (let i = 0; i < startDayOfWeek; i++) {
            // month: 0 は前月・次月の空欄として使用
            daysArray.push({ day: "", month: 0, dateStr: "" }); 
        }

        // 今月の日付を生成
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            daysArray.push({ day: d, month: m, dateStr });
        }

        // 次月の日付の空欄を埋める
        while (daysArray.length % 7 !== 0) {
            daysArray.push({ day: "", month: 0, dateStr: "" }); // 空の日付を挿入
        }

        return daysArray;
    };
    
    // カレンダーの日付データを生成
    const calendarDays = generateDays(year, month);
    // 今日の日付文字列
    const todayStr = now.toISOString().slice(0, 10);

    const handleDateClick = (dateStr: string) => {
        if (dateStr) {
            router.push(`${base_path}/${dateStr}`);
        }
    };
    
    // ★シフト状況に応じて背景色を決定するヘルパー関数
    const getStatusClasses = (dateStr: string, isCurrentMonth: boolean): string => {
        if (!isCurrentMonth) return 'bg-gray-50 text-gray-400 cursor-default';

        const status = statusData[dateStr];
        
        switch (status) {
            case 'confirmed':
                // シフト確定済
                return 'bg-green-100 hover:bg-green-200 border-green-300';
            case 'requested':
                // 希望提出済だが未確定 (要調整)
                return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300';
            case 'no_requests':
                // 誰も希望を提出していない
                return 'bg-white hover:bg-red-200 border-red-300';
            default:
                // データがない場合（未来の日付など）
                return 'bg-white hover:bg-indigo-50 border-gray-200';
        }
    };
    
    // ★シフト状況のテキストを表示するヘルパー関数
    const getStatusText = (dateStr: string): React.ReactNode => {
        const status = statusData[dateStr];
        
        switch (status) {
            case 'confirmed':
                return <span className="text-xs font-semibold text-green-700">✅ 確定済</span>;
            case 'requested':
                return <span className="text-xs font-semibold text-yellow-700">⏳ 未確定</span>;
            case 'no_requests':
                return <span className="text-xs font-semibold text-red-700">🚨 希望なし</span>;
            default:
                return <span className="text-xs text-gray-500">データなし</span>;
        }
    }


    return (
        <div className="bg-white shadow-xl rounded-lg p-6 border border-gray-200">
            
            {/* 月表示と月移動ナビゲーション (デザイン統一) */}
            <div className="flex items-center justify-between mb-6 border-b pb-4">
                <Link 
                    href={`${current_page_path}?year=${prevYear}&month=${prevMonth}`}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition duration-150 font-bold"
                    aria-label="前の月へ"
                >
                    &larr; 前の月
                </Link>

                <h2 className="text-2xl font-extrabold text-gray-900">
                    {year}年 {month}月
                </h2>

                <Link 
                    href={`${current_page_path}?year=${nextYear}&month=${nextMonth}`}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition duration-150 font-bold"
                    aria-label="次の月へ"
                >
                    次の月 &rarr;
                </Link>
            </div>
            
            {/* カレンダー本体 (グリッドレイアウト) */}
            <div className="grid grid-cols-7 border-t border-l border-gray-300">
                
                {/* 曜日ヘッダー */}
                {dayNames.map((dayName, idx) => (
                    <div 
                        key={dayName} 
                        className={`text-center font-bold py-3 text-sm text-white border-r border-b border-gray-300 ${idx === 0 ? 'bg-red-500' : idx === 6 ? 'bg-blue-500' : 'bg-gray-700'}`}
                    >
                        {dayName}
                    </div>
                ))}

                {/* 日付セル */}
                {calendarDays.map((day, idx) => {
                    // 今月の日付かどうか
                    const isCurrentMonth = day.month === month;
                    // クリック可能かどうか
                    const isClickable = day.day && isCurrentMonth;
                    // 今日かどうか
                    const isToday = day.dateStr === todayStr;
                    // 曜日 (0=日, 6=土)
                    const dayOfWeek = idx % 7;
                    
                    // ★ステータスに応じたクラスを取得
                    const statusClasses = getStatusClasses(day.dateStr, isCurrentMonth);

                    return (
                        <div 
                            key={day.dateStr || idx}
                            onClick={() => isClickable && handleDateClick(day.dateStr)}
                            className={`
                                h-28 p-2 border-r border-b border-gray-300 text-left transition duration-100 relative
                                ${statusClasses} /* ★ここをステータス色に変更 */
                                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                                ${isToday ? 'border-2 border-red-500 z-10' : ''} /* 今日の強調 */
                            `}
                        >
                            {/* 日付の数字 (右上に配置) */}
                            <div className={`text-sm font-bold absolute top-2 right-2 
                                ${!isCurrentMonth ? 'text-gray-400' : dayOfWeek === 0 ? 'text-red-700' : dayOfWeek === 6 ? 'text-blue-700' : 'text-gray-800'}`}>
                                {day.day || ""}
                            </div>
                            
                            {/* ★ シフト状況表示エリア */}
                            {isCurrentMonth && day.day && (
                                <div className="text-xs mt-8">
                                    {getStatusText(day.dateStr)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
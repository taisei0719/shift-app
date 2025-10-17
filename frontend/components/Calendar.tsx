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
    base_path: string; // 遷移先のベースパス (例: /admin/day または /staff/shift_input)
    current_page_path: string; // 月移動用の現在のページパス (例: /admin または /staff)
}

// 曜日名
const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

export default function Calendar({ base_path, current_page_path }: CalendarProps) {
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
            daysArray.push({ day: "", month: m - 1, dateStr: "" });
        }

        // 今月の日付を生成
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            daysArray.push({ day: d, month: m, dateStr });
        }

        // 次月の日付の空欄を埋める
        while (daysArray.length % 7 !== 0) {
            daysArray.push({ day: "", month: m + 1, dateStr: "" });
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

    return (
        <div className="bg-white shadow-xl rounded-lg p-6">
            
            {/* ★ 月表示と月移動ナビゲーション */}
            <div className="flex items-center justify-between mb-6">
                
                {/* 戻るボタン */}
                <Link 
                    href={`${current_page_path}?year=${prevYear}&month=${prevMonth}`}
                    className="p-2 text-indigo-600 hover:text-indigo-800 transition duration-150"
                    aria-label="前の月へ"
                >
                    &larr; 前の月
                </Link>

                {/* 現在の年月 */}
                <h2 className="text-3xl font-bold text-gray-900">
                    {year}年 {month}月
                </h2>

                {/* 進むボタン */}
                <Link 
                    href={`${current_page_path}?year=${nextYear}&month=${nextMonth}`}
                    className="p-2 text-indigo-600 hover:text-indigo-800 transition duration-150"
                    aria-label="次の月へ"
                >
                    次の月 &rarr;
                </Link>
            </div>
            
            {/* ★ カレンダー本体 (グリッドレイアウト) */}
            <div className="grid grid-cols-7 border border-gray-200 rounded-lg overflow-hidden">
                
                {/* 曜日ヘッダー */}
                {dayNames.map((dayName, idx) => (
                    <div 
                        key={dayName} 
                        className={`text-center font-bold py-3 text-sm text-white ${idx === 0 ? 'bg-red-500' : idx === 6 ? 'bg-blue-500' : 'bg-gray-700'}`}
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

                    return (
                        <div 
                            key={day.dateStr || idx}
                            onClick={() => isClickable && handleDateClick(day.dateStr)}
                            className={`
                                h-28 p-1 sm:p-2 border border-gray-200 text-left transition duration-100 relative
                                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400 cursor-default'}
                                ${isClickable ? 'cursor-pointer hover:bg-indigo-50' : ''}
                                ${isToday ? 'border-2 border-indigo-500 ring-2 ring-indigo-200' : ''}
                                ${dayOfWeek === 0 && isCurrentMonth ? 'text-red-600' : dayOfWeek === 6 && isCurrentMonth ? 'text-blue-600' : 'text-gray-800'}
                            `}
                        >
                            {/* 日付の数字 */}
                            <div className="text-sm font-semibold">
                                {day.day || ""}
                            </div>
                            
                            {/* シフトデータ表示エリア (ここでは空) */}
                            {isCurrentMonth && day.day && (
                                <div className="text-xs mt-1 text-gray-500">
                                    {/* (シフト概要などの情報をここに表示) */}
                                    <div className="text-transparent">Placeholder</div> 
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
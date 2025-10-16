// frontend/components/Calendar.tsx (AdminCalendarのロジックを移植)
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation"; // useRouterも使う

interface Day {
    day: number | "";
    month: number;
    dateStr: string;
}

interface CalendarProps {
    base_path: string; // 遷移先のベースパス (例: /admin/day または /staff/shift_input)
    current_page_path: string; // 月移動用の現在のページパス (例: /admin または /staff)
}

export default function Calendar({ base_path, current_page_path }: CalendarProps) {
    const searchParams = useSearchParams();
    const router = useRouter(); // routerを使って日付クリックを処理する

    // URLから年/月を取得 (パラメーターがない場合は現在の日付を使う)
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const now = new Date();
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

        // 前月の日付の空欄を埋める
        for (let i = 0; i < firstDay.getDay(); i++) {
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

    const handleDateClick = (dateStr: string) => {
        // base_path を使って指定されたURLに遷移
        router.push(`${base_path}/${dateStr}`); 
    };

    return (
        <div className="calendar-container">
            <h1>{year}年 {month}月</h1>

            {/* 月の移動リンク */}
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", margin: "10px 0" }}>
                <Link href={`${current_page_path}?year=${prevYear}&month=${prevMonth}`}>← 前の月</Link>
                <Link href={`${current_page_path}?year=${nextYear}&month=${nextMonth}`}>次の月 →</Link>
            </div>
            
            {/* 曜日ヘッダー */}
            <table border={1} style={{ width: "100%", textAlign: "center", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        {["日", "月", "火", "水", "木", "金", "土"].map(dayName => (
                            <th key={dayName} style={{ background: '#eee', padding: '10px' }}>{dayName}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* カレンダー本体 */}
                    {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                            {calendarDays.slice(rowIndex * 7, rowIndex * 7 + 7).map((day, idx) => (
                                <td 
                                    key={day.dateStr || idx}
                                    style={{ 
                                        padding: '15px 5px', 
                                        cursor: day.day && day.month === month ? "pointer" : "default",
                                        background: day.month === month ? "white" : "#f5f5f5"
                                    }}
                                    onClick={() => day.dateStr && handleDateClick(day.dateStr)}
                                >
                                    {/* 日付の数字 */}
                                    <div style={{ fontWeight: 'bold' }}>{day.day || ""}</div>
                                    
                                    {/* 詳細/遷移の表示 (見やすいように「詳細」の代わりにクリック可能にする) */}
                                    {day.month === month && day.day ? (
                                        <div style={{ fontSize: '12px', color: 'blue' }}>
                                            {/* (シフトデータ表示エリア) */}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: 'transparent' }}>.</div> // スペース確保用
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
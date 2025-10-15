// frontend/components/Calendar.tsx

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend, subMonths, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

// 型定義
interface DayData {
    day: number | "";
    month: number;
    dateStr: string; // YYYY-MM-DD
}

// シフト表示用の最小データ構造
interface ShiftDisplayData {
    [date: string]: {
        shifts: { 
            start: string, 
            end: string, 
            type: 'request' | 'confirmed' | 'day_off' // day_offを追加
        }[];
    };
}

interface CalendarProps {
    currentYear: number;
    currentMonth: number;
    // 月切り替え時のコールバック
    onMonthChange: (year: number, month: number) => void; 
    // 日付クリック時のコールバック
    onDateClick: (dateStr: string) => void; 
    // 日付の下に表示するシフトデータ
    shiftsByDate: ShiftDisplayData; 
    // 管理者ビュー用: 詳細ページへ遷移するか、クリックイベントを発生させるか
    isAdminView?: boolean; 
}

// 曜日の表示
const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

// ヘルパー関数: カレンダーの日付データを生成
const generateCalendarDays = (year: number, month: number): DayData[][] => {
    // month-1 は 0-indexed に変換
    const firstDayOfMonth = startOfMonth(new Date(year, month - 1));
    const lastDayOfMonth = endOfMonth(new Date(year, month - 1));
    
    // カレンダーの開始日: 月の最初の日の週の最初の日曜日
    const startOfWeek = new Date(firstDayOfMonth);
    startOfWeek.setDate(startOfWeek.getDate() - getDay(startOfWeek));

    // カレンダーの終了日: 月の最後の日の週の土曜日
    const endOfWeek = new Date(lastDayOfMonth);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - getDay(endOfWeek)));

    const days = eachDayOfInterval({ start: startOfWeek, end: endOfWeek });
    
    const calendarDays: DayData[] = days.map(day => ({
        day: day.getMonth() + 1 === month ? day.getDate() : "",
        month: day.getMonth() + 1, // 1-indexed
        dateStr: format(day, 'yyyy-MM-dd'),
    }));

    // 7日ごとに分割
    const weeks: DayData[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
};


export default function Calendar({ 
    currentYear, 
    currentMonth, 
    onMonthChange, 
    onDateClick, 
    shiftsByDate, 
    isAdminView = false 
}: CalendarProps) {
    
    const calendarDays = useMemo(() => generateCalendarDays(currentYear, currentMonth), [currentYear, currentMonth]);

    // 前月・次月計算
    const dateForCalculation = new Date(currentYear, currentMonth - 1, 1);
    const prevDate = subMonths(dateForCalculation, 1);
    const nextDate = addMonths(dateForCalculation, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth() + 1;
    
    // 日付クリックハンドラ: 今月の有効な日付のみクリック可能
    const handleDateClick = (dateStr: string, isCurrentMonth: boolean) => {
        if (isCurrentMonth) {
            onDateClick(dateStr);
        }
    };
    
    return (
        <div className="bg-white p-4 rounded-xl shadow-lg w-full max-w-4xl mx-auto">
            
            {/* 月切り替えヘッダー */}
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={() => onMonthChange(prevYear, prevMonth)}
                    className="p-2 rounded-full hover:bg-gray-100 transition duration-150 text-gray-700"
                >
                    &lt; 前月
                </button>
                <h2 className="text-xl font-semibold text-gray-800">
                    {currentYear}年 {currentMonth}月
                </h2>
                <button
                    onClick={() => onMonthChange(nextYear, nextMonth)}
                    className="p-2 rounded-full hover:bg-gray-100 transition duration-150 text-gray-700"
                >
                    次月 &gt;
                </button>
            </div>

            {/* カレンダー本体 */}
            <table className="w-full text-center border-collapse">
                <thead>
                    <tr className="bg-indigo-600 text-white">
                        {weekDays.map((day, index) => (
                            <th 
                                key={day} 
                                className={`p-2 font-medium border-r border-indigo-700 last:border-r-0 ${index === 0 ? 'text-red-300' : index === 6 ? 'text-blue-300' : ''}`}
                            >
                                {day}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {calendarDays.map((week, weekIndex) => (
                        <tr key={weekIndex}>
                            {week.map((day, dayIndex) => {
                                const isCurrentMonth = day.month === currentMonth;
                                const dateData = shiftsByDate[day.dateStr];
                                const dateObj = new Date(day.dateStr);

                                // 日付のスタイル
                                let cellClasses = "p-2 h-20 align-top border border-gray-200 transition duration-150 ease-in-out";
                                
                                // 土日の色付け
                                if (dayIndex === 0) { // 日曜日
                                    cellClasses += ' text-red-600';
                                } else if (dayIndex === 6) { // 土曜日
                                    cellClasses += ' text-blue-600';
                                }
                                
                                if (isCurrentMonth) {
                                    // 今月の有効な日付
                                    cellClasses += " cursor-pointer bg-white hover:bg-indigo-50 active:bg-indigo-100";
                                } else {
                                    // 前月・次月の日付
                                    cellClasses += " bg-gray-100 text-gray-400 cursor-default";
                                }

                                // シフト情報
                                const dayOffShift = dateData?.shifts.find(s => s.type === 'day_off');
                                const confirmedShifts = dateData?.shifts.filter(s => s.type === 'confirmed');
                                const requestShifts = dateData?.shifts.filter(s => s.type === 'request');
                                
                                const shiftContent = dayOffShift ? (
                                    <div className="mt-1 text-xs py-0.5 px-1 rounded-sm text-white bg-red-500 max-w-[90%] mx-auto font-bold">
                                        休み希望
                                    </div>
                                ) : (
                                    <div className="mt-1 text-xs space-y-0.5">
                                        {confirmedShifts?.map((shift, idx) => (
                                            <div 
                                                key={`conf-${idx}`}
                                                className="py-0.5 px-1 rounded-sm text-white bg-green-600 max-w-[90%] mx-auto font-bold truncate"
                                                title={`${shift.start} - ${shift.end}`}
                                            >
                                                確定: {shift.start.slice(0, 5)}~
                                            </div>
                                        ))}
                                        {requestShifts?.map((shift, idx) => (
                                            <div 
                                                key={`req-${idx}`}
                                                className="py-0.5 px-1 rounded-sm text-gray-800 bg-yellow-400 max-w-[90%] mx-auto truncate"
                                                title={`${shift.start} - ${shift.end}`}
                                            >
                                                希望: {shift.start.slice(0, 5)}~
                                            </div>
                                        ))}
                                    </div>
                                );
                                
                                return (
                                    <td 
                                        key={day.dateStr}
                                        className={cellClasses}
                                        onClick={() => handleDateClick(day.dateStr, isCurrentMonth)}
                                    >
                                        {/* 日付の数字 */}
                                        <div className="text-sm font-semibold">{day.day || ""}</div>
                                        
                                        {/* シフト情報 */}
                                        {isCurrentMonth && shiftContent}

                                        {/* 管理者ビューの場合のリンク (スタッフビューではフォーム表示) */}
                                        {isCurrentMonth && isAdminView && (
                                            <Link 
                                                href={`/admin/day/${day.dateStr}`} 
                                                className="block mt-1 text-xs text-indigo-500 hover:text-indigo-700"
                                                onClick={(e) => e.stopPropagation()} // セルクリックとリンククリックの重複防止
                                            >
                                                詳細
                                            </Link>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
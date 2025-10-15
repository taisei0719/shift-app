// frontend/components/Calendar.tsx

"use client";

import React, { useMemo } from "react";
import Link from "next/link"; // Linkは管理者ビューでのみ使用
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval, 
    getDay, 
    isWeekend, 
    subMonths, 
    addMonths,
    isToday 
} from 'date-fns';
import { ja } from 'date-fns/locale';

// --- 型定義 ---
interface DayData {
    day: number | "";
    month: number;
    dateStr: string; // YYYY-MM-DD
}

// シフト表示用のデータ構造
interface ShiftDisplayData {
    [date: string]: {
        shifts: { 
            start: string, 
            end: string, 
            type: 'request' | 'confirmed' | 'day_off' 
        }[];
    };
}

// ★ 修正後のCalendarProps ★
export interface CalendarProps {
    currentYear: number;
    currentMonth: number;
    // 月切り替え時のコールバック
    onMonthChange: (year: number, month: number) => void; 
    // 日付クリック時のコールバック (日付文字列を親に返す)
    onDateClick: (dateStr: string, isCurrentMonth: boolean) => void; 
    // 日付の下に表示するシフトデータ
    shiftsByDate: ShiftDisplayData; 
    // 管理者ビュー用 (スタッフビューのロジックが異なるため)
    isAdminView?: boolean; 
    // 管理者ビューでユーザー名を表示する場合に利用
    staffNamesByDate?: { [date: string]: string[] }; 
}

// 曜日の表示
const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

export default function Calendar({ 
    currentYear, 
    currentMonth, 
    onMonthChange, 
    onDateClick, 
    shiftsByDate, 
    isAdminView = false,
    staffNamesByDate = {}
}: CalendarProps) {

    // --- 月の計算 ---
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    
    const prevDate = subMonths(monthStart, 1);
    const nextDate = addMonths(monthStart, 1);
    
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;

    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth() + 1;


    // --- カレンダーデータの生成 ---
    const calendarDays = useMemo(() => {
        const startDayOfWeek = getDay(monthStart); // 0: 日曜日, 6: 土曜日
        const endDayOfWeek = getDay(monthEnd);

        // 前月の日付
        const prevMonthEnd = subMonths(monthStart, 1);
        const prevMonthDays = [];
        for (let i = startDayOfWeek; i > 0; i--) {
            const date = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() - i + 1);
            prevMonthDays.push({ 
                day: date.getDate(), 
                month: date.getMonth() + 1,
                dateStr: format(date, 'yyyy-MM-dd')
            });
        }

        // 当月の日付
        const currentMonthDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).map(date => ({
            day: date.getDate(),
            month: date.getMonth() + 1,
            dateStr: format(date, 'yyyy-MM-dd')
        }));

        // 次月の日付
        const nextMonthStart = addMonths(monthEnd, 1);
        const nextMonthDays = [];
        for (let i = 1; (prevMonthDays.length + currentMonthDays.length + i) % 7 !== 0 || i < 7 - endDayOfWeek; i++) {
            const date = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), i);
            nextMonthDays.push({ 
                day: date.getDate(), 
                month: date.getMonth() + 1,
                dateStr: format(date, 'yyyy-MM-dd')
            });
        }

        const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
        const weeks = [];
        for (let i = 0; i < allDays.length; i += 7) {
            weeks.push(allDays.slice(i, i + 7));
        }
        return weeks;
    }, [currentYear, currentMonth]);


    // --- レンダー部分 ---
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <button 
                    onClick={() => onMonthChange(prevYear, prevMonth)} 
                    className="p-2 text-indigo-600 hover:bg-gray-100 rounded-full transition"
                >
                    &lt; 前月
                </button>
                <h2 className="text-xl font-bold">
                    {format(monthStart, 'yyyy年 M月', { locale: ja })}
                </h2>
                <button 
                    onClick={() => onMonthChange(nextYear, nextMonth)} 
                    className="p-2 text-indigo-600 hover:bg-gray-100 rounded-full transition"
                >
                    次月 &gt;
                </button>
            </div>

            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-indigo-50 text-indigo-800">
                        {weekDays.map(day => (
                            <th key={day} className="py-2 border-b text-sm font-medium">{day}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {calendarDays.map((week, idx) => (
                        <tr key={idx} className="h-24">
                            {week.map((day, dayIdx) => {
                                const isCurrentMonth = day.month === currentMonth;
                                const isSelected = false; // 選択状態のスタイルは親コンポーネントで管理しても良い
                                const isWeekendDay = dayIdx === 0 || dayIdx === 6; // 日曜日または土曜日
                                const todayDate = format(new Date(), 'yyyy-MM-dd');
                                const isTodayDay = isToday(new Date(day.dateStr));
                                
                                const shiftData = shiftsByDate[day.dateStr]?.shifts || [];
                                const hasConfirmed = shiftData.some(s => s.type === 'confirmed');
                                const hasRequest = shiftData.some(s => s.type === 'request');
                                const hasDayOff = shiftData.some(s => s.type === 'day_off');

                                let cellClasses = `p-1 border text-center align-top transition duration-150 relative `;

                                if (isCurrentMonth) {
                                    cellClasses += `bg-white cursor-pointer hover:bg-indigo-50 `;
                                } else {
                                    cellClasses += `bg-gray-50 text-gray-400 `;
                                }
                                
                                if (isTodayDay && isCurrentMonth) {
                                    cellClasses += `border-2 border-indigo-500 ring-2 ring-indigo-300`;
                                }
                                if (isWeekendDay && isCurrentMonth) {
                                    cellClasses += dayIdx === 0 ? 'text-red-600' : 'text-blue-600';
                                }
                                
                                // シフト内容の表示
                                const shiftContent = (
                                    <div className="mt-1 space-y-0.5">
                                        {isAdminView ? (
                                            <>
                                                {shiftData.length > 0 && <span className="block text-xs font-medium text-green-700">シフト有 ({shiftData.length}件)</span>}
                                                {staffNamesByDate[day.dateStr]?.slice(0, 2).map((name, i) => (
                                                    <p key={i} className="text-xs text-gray-600 truncate">{name}</p>
                                                ))}
                                                {staffNamesByDate[day.dateStr]?.length > 2 && <p className="text-xs text-gray-500">他{staffNamesByDate[day.dateStr].length - 2}名</p>}
                                            </>
                                        ) : (
                                            <>
                                                {hasConfirmed && <span className="block text-xs font-bold text-red-500">【確定】</span>}
                                                {!hasConfirmed && hasDayOff && <span className="block text-xs font-medium text-blue-500">【休み希望】</span>}
                                                {!hasConfirmed && hasRequest && (
                                                    shiftData.filter(s => s.type === 'request').map((s, i) => (
                                                        <p key={i} className="text-xs text-indigo-600 font-medium">
                                                            {s.start.substring(0, 5)}~{s.end.substring(0, 5)}
                                                        </p>
                                                    ))
                                                )}
                                                {!hasConfirmed && !hasRequest && !hasDayOff && isCurrentMonth && <p className="text-xs text-gray-400">未提出</p>}
                                            </>
                                        )}
                                    </div>
                                );
                                
                                // クリックハンドラ: 当月の日付のみクリック可能
                                const handleCellClick = () => {
                                    if (day.dateStr) {
                                        onDateClick(day.dateStr, isCurrentMonth);
                                    }
                                };
                                
                                return (
                                    <td 
                                        key={day.dateStr || idx}
                                        className={cellClasses}
                                        onClick={isCurrentMonth ? handleCellClick : undefined}
                                    >
                                        {/* 日付の数字 */}
                                        <div className="text-sm font-semibold">{day.day || ""}</div>
                                        
                                        {/* シフト情報 */}
                                        {isCurrentMonth && shiftContent}
                                        
                                        {/* 管理者ビューの場合のリンク（スタッフビューでは不要） */}
                                        {isCurrentMonth && isAdminView && day.dateStr && (
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
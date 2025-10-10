// frontend/app/staff/shifts/_ShiftCalendarClient.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';

// 型定義
interface ShiftData {
    id: number;
    shift_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    shift_type: 'request' | 'confirmed';
}

interface ShiftsByDate {
    [date: string]: ShiftData[]; // 日付文字列をキーとするシフトの配列
}

interface Props {
    initialYear: number;
    initialMonth: number;
}

export default function ShiftCalendarClient({ initialYear, initialMonth }: Props) {
    const router = useRouter();
    // 表示する年月
    const [currentDate, setCurrentDate] = useState(new Date(initialYear, initialMonth - 1, 1));
    // ロードされたシフトデータ
    const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // フォーム関連
    const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    // APIから月間シフトデータを取得する関数
    const fetchShifts = useCallback(async (y: number, m: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/shifts/month/${y}/${m}`);
            if (!res.ok) {
                // 401 Unauthorized の場合はログインページにリダイレクト
                if (res.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error('シフトデータの取得に失敗しました。');
            }
            const data = await res.json();
            setShiftsByDate(data.shifts_by_date || {});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'データの取得中に予期せぬエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    // 年月が変わるたびにシフトデータを再取得
    useEffect(() => {
        fetchShifts(year, month);
    }, [year, month, fetchShifts]);

    // カレンダーの日付リストを計算
    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        // 月初から月末までの全ての日付を取得
        return eachDayOfInterval({ start, end });
    }, [currentDate]);
    
    // カレンダーの表示開始位置を調整するための空のマス目を計算
    const startingDayOfWeek = daysInMonth[0].getDay(); // 0: 日曜, 6: 土曜

    // ---------------------- フォーム操作 ----------------------
    
    // 日付を選択したときの処理 (提出フォームを表示)
    const handleDayClick = (dateObj: Date) => {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        setSelectedDate(dateStr);
        setMessage(null); // メッセージをクリア
        
        // 既存の希望シフトがあれば、フォームに時間をセット
        const existingShift = shiftsByDate[dateStr]?.find(s => s.shift_type === 'request');
        if (existingShift) {
            setStartTime(existingShift.start_time);
            setEndTime(existingShift.end_time);
        } else {
            // 休みや未提出の場合はフォームをクリア
            setStartTime('00:00'); 
            setEndTime('00:00');
        }
    };
    
    // シフト提出（希望シフトの登録/更新）
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate) return;
        
        setIsLoading(true);
        setMessage(null);
        
        const isDayOff = startTime === '00:00' && endTime === '00:00';
        
        // 提出データは常に配列として送信
        const shiftData = [{
            date: selectedDate, // ★ キーを shift_date から date に修正
            start: startTime,   // ★ キーを start_time から start に修正
            end: endTime,       // ★ キーを end_time から end に修正
        }];

        try {
            const res = await fetch('/api/shifts/submit_request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 休みの場合も含む全てのデータ送信
                body: JSON.stringify({ requests: shiftData }),
            });

            const data = await res.json();
            
            if (res.ok) {
                // 成功したらデータを再取得してカレンダーを更新
                setMessage(isDayOff ? '休みとして提出しました！' : 'シフト希望を提出しました！');
                await fetchShifts(year, month);
            } else {
                setMessage(`提出失敗: ${data.error || 'サーバーエラー'}`);
            }

        } catch (err) {
            setMessage('提出中にエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };
    
    // ---------------------- ナビゲーション ----------------------
    
    const goToPreviousMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
            return newDate;
        });
    };

    const goToNextMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
            return newDate;
        });
    };
    
    // ---------------------- レンダリング ----------------------

    const renderShiftInfo = (dateStr: string) => {
        const shifts = shiftsByDate[dateStr];
        if (!shifts || shifts.length === 0) {
            return <span className="text-gray-400 text-xs">未提出</span>;
        }

        // 確定シフトがあればそれを最優先で表示
        const confirmedShift = shifts.find(s => s.shift_type === 'confirmed');
        if (confirmedShift) {
            return (
                <div className="text-xs font-bold text-green-600">
                    確定: {confirmedShift.start_time.substring(0, 5)} - {confirmedShift.end_time.substring(0, 5)}
                </div>
            );
        }

        // 希望シフトがあればそれを表示
        const requestedShift = shifts.find(s => s.shift_type === 'request');
        if (requestedShift) {
            // 休み('00:00'-'00:00')の判定
            if (requestedShift.start_time.substring(0, 5) === '00:00' && requestedShift.end_time.substring(0, 5) === '00:00') {
                return <span className="text-xs text-blue-500">休み希望</span>;
            }
            return (
                <div className="text-xs text-yellow-600">
                    希望: {requestedShift.start_time.substring(0, 5)} - {requestedShift.end_time.substring(0, 5)}
                </div>
            );
        }
        
        return <span className="text-gray-400 text-xs">未提出</span>;
    };
    
    // 時刻オプションの生成 (30分刻み)
    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                options.push(timeStr);
            }
        }
        //options.push('00:00'); // 休み用として念のため再追加
        return options;
    }, []);

    return (
        <div className="flex **flex-row** gap-8">
            {/* -------------------- カレンダー表示エリア -------------------- */}
            <div className="**w-3/5** bg-white p-6 shadow-lg rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={goToPreviousMonth} className="p-2 rounded-full hover:bg-gray-100">&lt; 前の月</button>
                    <h2 className="text-xl font-semibold">{format(currentDate, 'yyyy年M月', { locale: ja })}</h2>
                    <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-gray-100">次の月 &gt;</button>
                </div>
                
                {isLoading ? (
                    <div className="text-center py-8">ロード中...</div>
                ) : error ? (
                    <div className="text-center py-8 text-red-500">エラー: {error}</div>
                ) : (
                    <div className="grid grid-cols-7 text-center border-t border-l">
                        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                            <div key={day} className={`py-2 font-bold border-r border-b ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : ''}`}>
                                {day}
                            </div>
                        ))}
                        
                        {/* 月の初めまでの空のマス */}
                        {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                            <div key={`empty-${index}`} className="p-2 border-r border-b bg-gray-50"></div>
                        ))}
                        
                        {/* 日付とシフト情報 */}
                        {daysInMonth.map((day, index) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isToday = isSameDay(day, new Date());
                            const isSelected = selectedDate === dateStr;
                            
                            // 過去の日付はクリック不可
                            const isPast = day.getTime() < new Date().setHours(0,0,0,0);

                            return (
                                <button 
                                    key={dateStr}
                                    onClick={() => !isPast && handleDayClick(day)}
                                    className={`
                                        p-2 h-24 border-r border-b text-left transition-all duration-150
                                        ${isPast ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-indigo-50 hover:shadow-inner cursor-pointer'}
                                        ${isToday ? 'border-2 border-red-500 bg-red-50' : ''}
                                        ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500' : ''}
                                    `}
                                    disabled={isPast}
                                >
                                    <div className={`text-sm font-semibold mb-1 ${day.getDay() === 0 ? 'text-red-600' : day.getDay() === 6 ? 'text-blue-600' : ''}`}>
                                        {format(day, 'd')}
                                    </div>
                                    <div className="text-xs">
                                        {renderShiftInfo(dateStr)}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            
            {/* -------------------- シフト提出フォームエリア -------------------- */}
            <div className="**w-2/5** bg-white p-6 shadow-lg rounded-lg sticky top-4 self-start">
                <h3 className="text-xl font-semibold border-b pb-3 mb-4">シフト提出</h3>
                
                {selectedDate ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <p className="text-lg font-bold">対象日: {format(new Date(selectedDate), 'yyyy年M月d日 (eee)', { locale: ja })}</p>

                        <div className="flex gap-2 items-center">
                            <label htmlFor="start_time" className="block text-sm font-medium w-1/4">開始時刻</label>
                            <select
                                id="start_time"
                                value={startTime}
                                onChange={(e) => {
                                    setStartTime(e.target.value);
                                    if (e.target.value === '00:00') setEndTime('00:00'); // 開始00:00なら終了も00:00に強制
                                }}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                            >
                                {timeOptions.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 items-center">
                            <label htmlFor="end_time" className="block text-sm font-medium w-1/4">終了時刻</label>
                            <select
                                id="end_time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                                disabled={startTime === '00:00'} // 休みの場合、終了時刻は変更不可
                            >
                                {timeOptions.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="day_off"
                                checked={startTime === '00:00' && endTime === '00:00'}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setStartTime('00:00');
                                        setEndTime('00:00');
                                    } else {
                                        setStartTime('');
                                        setEndTime('');
                                    }
                                }}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                            <label htmlFor="day_off" className="text-sm font-medium text-gray-700">この日は休みを希望する</label>
                        </div>

                        <button 
                            type="submit"
                            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                            disabled={isLoading}
                        >
                            {isLoading ? '提出中...' : 'シフトを提出・更新する'}
                        </button>
                        
                        {message && (
                            <p className={`text-center text-sm ${message.includes('失敗') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>
                        )}

                        <button 
                            type="button"
                            onClick={() => setSelectedDate(null)}
                            className="w-full text-center mt-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                            閉じる
                        </button>
                    </form>
                ) : (
                    <p className="text-gray-500">カレンダーから日付を選択してください。</p>
                )}
            </div>
        </div>
    );
}
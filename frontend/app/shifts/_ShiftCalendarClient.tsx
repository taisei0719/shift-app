// frontend/app/shifts/_ShiftCalendarClient.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/context/UserContext'; 
// 日付処理ライブラリをインポート
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';

// 型定義
interface ShiftData {
    id: number;
    shift_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
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
    const { user } = useUser();
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

    // APIから月間シフトデータを取得する関数 (useCallbackでメモ化)
    const fetchShifts = useCallback(async (y: number, m: number) => {
        // ユーザー情報がない場合はAPIコールをスキップする
        if (!user) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            // fetch を使う場合、Cookie/セッションのための設定 'credentials: "include"' を追加
            const res = await fetch(`${baseUrl}/shifts/month/${y}/${m}`, {
                credentials: 'include' 
            });
            if (!res.ok) {
                throw new Error('シフトデータの取得に失敗しました。');
            }
            const data = await res.json();
            setShiftsByDate(data.shifts_by_date || {});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'データの取得中に予期せぬエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // 年月が変わるたびにシフトデータを再取得
    useEffect(() => {
        // user が存在する場合にのみ fetchShifts を実行
        if (user) { 
            fetchShifts(year, month);
        } else {
            setIsLoading(false); // ロード状態を解除
        }
    }, [year, month, fetchShifts, user]); 

    // カレンダーの日付リストを計算
    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        // 月初から月末までの全ての日付を取得
        return eachDayOfInterval({ start, end });
    }, [currentDate]);
    
    // カレンダーの表示開始位置を調整するための空のマス目を計算 (0: 日曜, 6: 土曜)
    const startingDayOfWeek = daysInMonth[0].getDay(); 

    // ---------------------- フォーム操作 ----------------------
    
    // 日付を選択したときの処理 (提出フォームを表示)
    const handleDayClick = (dateObj: Date) => {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        setSelectedDate(dateStr);
        setMessage(null); // メッセージをクリア
        
        // 既存の希望シフトがあれば、フォームに時間をセット
        const existingShift = shiftsByDate[dateStr]?.find(s => s.shift_type === 'request');
        if (existingShift) {
            // 時刻は HH:MM 形式で表示するために .substring(0, 5) を使用
            setStartTime(existingShift.start_time.substring(0, 5));
            setEndTime(existingShift.end_time.substring(0, 5));
        } else {
            // 休みや未提出の場合はフォームを初期化
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
        
        // 休み希望かどうかの判定
        const isDayOff = startTime === '00:00' && endTime === '00:00';
        
        // APIに送信するデータ構造
        const shiftData = [{
            date: selectedDate,
            start: startTime,
            end: endTime,
        }];

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const res = await fetch(`${baseUrl}/shifts/submit_request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ requests: shiftData }),
            });

            const data = await res.json();
            
            if (res.ok) {
                // 成功したらデータを再取得してカレンダーを更新
                setMessage(isDayOff ? '休み希望を提出しました！' : 'シフト希望を提出・更新しました！');
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
        setSelectedDate(null); // 月移動したら選択解除
    };

    const goToNextMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
            return newDate;
        });
        setSelectedDate(null); // 月移動したら選択解除
    };
    
    // ---------------------- レンダリング用ヘルパー ----------------------

    // カレンダーセルの中にシフト情報を表示する関数
    const renderShiftInfo = (dateStr: string) => {
        const shifts = shiftsByDate[dateStr];
        if (!shifts || shifts.length === 0) {
            return <span className="text-gray-400 text-xs">未提出</span>;
        }

        // 確定シフトがあればそれを最優先で表示
        const confirmedShift = shifts.find(s => s.shift_type === 'confirmed');
        if (confirmedShift) {
            return (
                // 確定シフトはより重要な情報なので、少し大きく、太字に
                <div className="text-xs font-bold text-green-600 truncate">
                    確定: {confirmedShift.start_time.substring(0, 5)} - {confirmedShift.end_time.substring(0, 5)}
                </div>
            );
        }

        // 希望シフトがあればそれを表示
        const requestedShift = shifts.find(s => s.shift_type === 'request');
        if (requestedShift) {
            const start = requestedShift.start_time.substring(0, 5);
            const end = requestedShift.end_time.substring(0, 5);
            
            // 休み('00:00'-'00:00')の判定
            if (start === '00:00' && end === '00:00') {
                return <span className="text-xs font-semibold text-blue-500">休み希望</span>;
            }
            return (
                <div className="text-xs font-medium text-yellow-700 truncate">
                    希望: {start} - {end}
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
        options.push('00:00'); // 休み希望用に '00:00' も追加
        return Array.from(new Set(options)).sort(); 
    }, []);

    // ---------------------- メインレンダリング ----------------------

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
                
                {/* -------------------- カレンダー表示エリア (左側) -------------------- */}
                <div className="w-full lg:w-3/5 bg-white p-6 shadow-xl rounded-lg border border-gray-200">
                    
                    {/* 月のナビゲーション */}
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <button onClick={goToPreviousMonth} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition duration-150 font-bold">&larr; 前の月</button>
                        <h2 className="text-2xl font-extrabold text-gray-900">{format(currentDate, 'yyyy年M月', { locale: ja })}</h2>
                        <button onClick={goToNextMonth} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition duration-150 font-bold">次の月 &rarr;</button>
                    </div>
                    
                    {isLoading ? (
                        <div className="text-center py-16 text-indigo-600 font-semibold">データを読み込み中...</div>
                    ) : error ? (
                        <div className="text-center py-16 text-red-600 font-semibold border border-red-300 bg-red-50 rounded-md">エラー: {error}</div>
                    ) : (
                        // カレンダーグリッド
                        <div className="grid grid-cols-7 border-t border-l border-gray-300">
                            {/* 曜日ヘッダー ★text-center を追加 */}
                            {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                                <div 
                                    key={day} 
                                    className={`py-3 font-bold text-sm text-white border-r border-b border-gray-300 text-center 
                                        ${index === 0 ? 'bg-red-500' : index === 6 ? 'bg-blue-500' : 'bg-gray-700'}`}
                                >
                                    {day}
                                </div>
                            ))}
                            
                            {/* 月の初めまでの空のマス */}
                            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                                <div key={`empty-${index}`} className="p-2 **h-28** border-r border-b border-gray-300 bg-gray-50"></div>
                            ))}
                            
                            {/* 日付とシフト情報 */}
                            {daysInMonth.map((day) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const isToday = isSameDay(day, new Date());
                                const isSelected = selectedDate === dateStr;
                                // 過去の日付はクリック不可とする
                                const isPast = day.getTime() < new Date().setHours(0,0,0,0);
                                const isFuture = day.getTime() >= new Date().setHours(0,0,0,0); 
                                
                                return (
                                    <button 
                                        key={dateStr}
                                        onClick={() => isFuture && handleDayClick(day)} // 過去はクリック不可
                                        className={`
                                            p-2 **h-28** border-r border-b border-gray-300 text-left transition-all duration-150 relative
                                            ${isPast ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'hover:bg-indigo-50 cursor-pointer'}
                                            ${isToday && isFuture ? 'border-2 border-red-500 bg-red-50' : ''}
                                            ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500 z-10' : ''}
                                        `}
                                        disabled={isPast}
                                    >
                                        {/* 日付の数字は右上に寄せて、見やすくする */}
                                        <div className={`text-sm font-bold mb-1 absolute top-1 right-2 
                                            ${day.getDay() === 0 ? 'text-red-700' : day.getDay() === 6 ? 'text-blue-700' : 'text-gray-800'}`}>
                                            {format(day, 'd')}
                                        </div>
                                        {/* シフト情報は左上から少し下げて配置 */}
                                        <div className="mt-6 text-center">
                                            {renderShiftInfo(dateStr)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                {/* -------------------- シフト提出フォームエリア (右側) -------------------- */}
                <div className="w-full lg:w-2/5 bg-white p-6 shadow-xl rounded-lg border border-gray-200 sticky lg:top-8 self-start">
                    <h3 className="text-xl font-extrabold text-gray-900 border-b pb-3 mb-4">希望シフト提出フォーム</h3>
                    
                    {selectedDate ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <p className="text-lg font-bold text-indigo-700">対象日: {format(new Date(selectedDate), 'yyyy年M月d日 (eee)', { locale: ja })}</p>

                            <div className="space-y-4">
                                {/* 開始時刻 */}
                                <div className="flex flex-col">
                                    <label htmlFor="start_time" className="text-sm font-medium text-gray-700 mb-1">開始時刻</label>
                                    <select
                                        id="start_time"
                                        value={startTime}
                                        onChange={(e) => {
                                            setStartTime(e.target.value);
                                            // 休み希望の場合、終了時刻を 00:00 に強制する
                                            if (e.target.value === '00:00') setEndTime('00:00');
                                        }}
                                        required
                                        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border bg-white"
                                    >
                                        {timeOptions.map(time => (
                                            <option key={`start-${time}`} value={time}>{time}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* 終了時刻 */}
                                <div className="flex flex-col">
                                    <label htmlFor="end_time" className="text-sm font-medium text-gray-700 mb-1">終了時刻</label>
                                    <select
                                        id="end_time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        required
                                        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border bg-white disabled:bg-gray-50 disabled:text-gray-500"
                                        disabled={startTime === '00:00'} // 休み希望中は変更不可
                                    >
                                        {timeOptions.map(time => (
                                            <option key={`end-${time}`} value={time}>{time}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 休み希望チェックボックス */}
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
                                                // チェック解除時は初期値に戻す（今回は適当な時間）
                                                setStartTime('09:00'); 
                                                setEndTime('17:00');
                                            }
                                        }}
                                        className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <label htmlFor="day_off" className="text-base font-medium text-gray-700">この日は休みを希望する</label>
                                </div>
                            </div>
                            
                            {/* 提出ボタン */}
                            <button 
                                type="submit"
                                className="w-full py-3 px-4 border border-transparent rounded-lg shadow-lg text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 transition duration-150"
                                disabled={isLoading}
                            >
                                {isLoading ? '提出中...' : 'シフトを提出・更新する'}
                            </button>
                            
                            {/* 提出後のメッセージ */}
                            {message && (
                                <p className={`text-center text-sm font-semibold p-2 rounded-md ${message.includes('失敗') ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100'}`}>{message}</p>
                            )}

                            {/* フォームを閉じるボタン */}
                            <button 
                                type="button"
                                onClick={() => setSelectedDate(null)}
                                className="w-full text-center mt-4 text-sm text-gray-500 hover:text-indigo-600 transition duration-150"
                            >
                                閉じる
                            </button>
                        </form>
                    ) : (
                        <p className="text-gray-500 text-center py-10 border border-dashed rounded-lg">カレンダーから日付を選択して、希望シフトを入力してください。</p>
                    )}
                </div>
            </div>
        </div>
    );
}
// frontend/app/staff/shifts/_ShiftCalendarClient.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/context/UserContext'; 
import { format, getMonth, getYear } from 'date-fns';
import { ja } from 'date-fns/locale';
// ★ 共通コンポーネントのCalendarをインポート
import Calendar from '@/components/Calendar'; 

// 型定義
interface ShiftData {
    id: number;
    shift_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    shift_type: 'request' | 'confirmed' | 'day_off'; // day_offを含む
}

interface ShiftsByDate {
    [date: string]: ShiftData[]; // 日付文字列をキーとするシフトの配列
}

// フォームのデフォルト値
const defaultFormData = {
    start_time: '09:00',
    end_time: '18:00',
    day_off: false,
};

interface Props {
    initialYear: number;
    initialMonth: number;
}

export default function ShiftCalendarClient({ initialYear, initialMonth }: Props) {
    const router = useRouter();
    const { user } = useUser();
    
    // 表示する年月 (1-indexed)
    const [currentDate, setCurrentDate] = useState(new Date(initialYear, initialMonth - 1, 1));
    const currentYear = getYear(currentDate);
    const currentMonth = getMonth(currentDate) + 1; // 1-indexed

    // ロードされたシフトデータ
    const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // フォーム関連
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [formData, setFormData] = useState(defaultFormData);
    const [message, setMessage] = useState<string | null>(null);

    // シフトデータの取得ロジック (変更なし)
    const fetchShifts = useCallback(async (year: number, month: number) => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const res = await fetch(`${baseUrl}/shifts/month/${year}/${month}`, { 
                credentials: 'include' 
            });

            if (!res.ok) {
                throw new Error('シフトデータの取得に失敗しました。');
            }

            const data = await res.json();
            
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
        // user情報が存在しない（ログアウト時など）はスキップ
        if (!user && !isLoading) {
             // 未ログイン時のリダイレクトはlayout.tsxやpage.tsxで処理すべきだが、
             // safety checkとして残しておく
             return;
        } 
        fetchShifts(currentYear, currentMonth);
    }, [currentYear, currentMonth, fetchShifts, user, isLoading]);


    // Calendarコンポーネントに渡すためのシフトデータ形式への変換
    const calendarShiftData = useMemo(() => {
        const data: any = {};
        Object.entries(shiftsByDate).forEach(([date, shifts]) => {
            data[date] = {
                shifts: shifts.map(s => ({
                    start: s.start_time,
                    end: s.end_time,
                    type: s.shift_type, // 'request', 'confirmed', 'day_off'
                }))
            };
        });
        return data;
    }, [shiftsByDate]);


    // ★ Calendarに渡すハンドラ 1: 月切り替え時の処理
    const handleMonthChange = useCallback((year: number, month: number) => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDate(null); // 日付選択をリセット
        setFormData(defaultFormData);
        setMessage(null);
    }, []);


    // ★ Calendarに渡すハンドラ 2: 日付クリック時の処理（フォーム表示）
    const handleDateClick = useCallback((dateStr: string) => {
        // スタッフは自分のリクエスト（'request'または'day_off'）のみ編集対象
        const existingShift = shiftsByDate[dateStr]?.find(s => s.shift_type !== 'confirmed'); 
        
        setSelectedDate(dateStr);
        setMessage(null);
        
        // 既存のシフトがあればフォームに反映
        if (existingShift) {
            setFormData({
                start_time: existingShift.start_time,
                end_time: existingShift.end_time,
                day_off: existingShift.shift_type === 'day_off',
            });
        } else {
            // シフトがなければデフォルト値
            setFormData(defaultFormData);
        }
    }, [shiftsByDate]);


    // フォームの入力変更ハンドラ (変更なし)
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox' && name === 'day_off') {
            const isChecked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({
                ...prev,
                day_off: isChecked,
            }));
            if (isChecked) {
                setFormData(prev => ({
                    ...prev,
                    start_time: '00:00', 
                    end_time: '00:00',
                }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };


    // シフト提出ハンドラ (変更なし)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || isLoading) return;

        setIsLoading(true);
        setMessage(null);
        setError(null);
        
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const endpoint = `${baseUrl}/shifts`; 

            const shift_type = formData.day_off ? 'day_off' : 'request';
            const submit_start_time = formData.day_off ? '00:00' : formData.start_time;
            const submit_end_time = formData.day_off ? '00:00' : formData.end_time;

            const payload = {
                shift_date: selectedDate,
                start_time: submit_start_time,
                end_time: submit_end_time,
                shift_type: shift_type
            };
            
            const existingShift = shiftsByDate[selectedDate]?.find(s => s.shift_type !== 'confirmed'); 
            const method = existingShift ? 'PUT' : 'POST';
            const url = existingShift ? `${endpoint}/${existingShift.id}` : endpoint;


            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'シフトの提出に失敗しました。');
            }
            
            setMessage('シフトを提出・更新しました！');
            await fetchShifts(currentYear, currentMonth);

        } catch (err) {
            setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
            setMessage(`提出に失敗: ${err instanceof Error ? err.message : '不明なエラー'}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    
    // --- レンダー部分 ---
    
    if (error && !isLoading) {
        return <p className="text-red-500 text-center mt-8">エラー: {error}</p>;
    }
    
    return (
        <div className="flex flex-col lg:flex-row gap-6">
            
            {/* 1. カレンダー部分 (共通Calendarコンポーネントを使用) */}
            <div className="lg:w-3/4 w-full">
                <Calendar
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                    onMonthChange={handleMonthChange}
                    onDateClick={handleDateClick}
                    shiftsByDate={calendarShiftData}
                    // スタッフ用のビューなので isAdminView は false (デフォルト)
                />
            </div>
            
            {/* 2. フォーム/詳細表示部分 (変更なし) */}
            <div className="lg:w-1/4 w-full bg-white p-6 rounded-xl shadow-lg h-fit">
                <h2 className="text-xl font-bold mb-4">シフト提出</h2>

                {selectedDate ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <p className="text-lg font-semibold text-indigo-600 mb-4">{format(new Date(selectedDate), 'yyyy年M月d日 (EEE)', { locale: ja })}</p>

                        <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                                <input
                                    id="day_off"
                                    name="day_off"
                                    type="checkbox"
                                    checked={formData.day_off}
                                    onChange={handleFormChange}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                />
                                <label htmlFor="day_off" className="text-sm font-medium text-gray-700">この日は休みを希望する</label>
                            </div>

                            <div className="flex space-x-2">
                                <label htmlFor="start_time" className="sr-only">開始時間</label>
                                <input
                                    id="start_time"
                                    name="start_time"
                                    type="time"
                                    value={formData.start_time}
                                    onChange={handleFormChange}
                                    disabled={formData.day_off}
                                    required={!formData.day_off}
                                    className="block w-1/2 p-2 border border-gray-300 rounded"
                                />
                                <span className="p-2">-</span>
                                <label htmlFor="end_time" className="sr-only">終了時間</label>
                                <input
                                    id="end_time"
                                    name="end_time"
                                    type="time"
                                    value={formData.end_time}
                                    onChange={handleFormChange}
                                    disabled={formData.day_off}
                                    required={!formData.day_off}
                                    className="block w-1/2 p-2 border border-gray-300 rounded"
                                />
                            </div>
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
                        {error && (
                            <p className="text-center text-sm text-red-500">{error}</p>
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
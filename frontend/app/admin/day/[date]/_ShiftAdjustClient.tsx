//app/admin/day/[date]/_ShiftAdjustClient.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api"; // プロジェクト設定に合わせてパスを修正してください

// Plotlyは使用していないため削除

// -------------------- 型定義 --------------------
// 簡略化のため、このファイル内に再定義
interface ShiftData {
    id: number;
    user_id: number;
    shop_id: number;
    shift_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    shift_type: 'request' | 'confirmed';
    user_name: string;
}

interface StaffShiftEntry {
    user_id: number;
    name: string;
    role: string;
    requests: ShiftData[];
    confirmed: ShiftData[];
    adjusted_shifts: ShiftData[]; 
}

// -------------------- ヘルパー関数 --------------------
const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const calculateDate = (currentDateStr: string, offset: number): string => {
    const current = new Date(`${currentDateStr}T00:00:00`);
    current.setDate(current.getDate() + offset);
    return formatDate(current);
};

// -------------------- クライアントコンポーネント --------------------
// paramsではなく、date propとして値を受け取る
export default function ShiftAdjustClient({ date }: { date: string }) {
    const [staffData, setStaffData] = useState<StaffShiftEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const previousDate = calculateDate(date, -1);
    const nextDate = calculateDate(date, 1);
    
    // スケジュール時間のオプション
    const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
        const hour = Math.floor(i / 4).toString().padStart(2, '0');
        const minute = ((i % 4) * 15).toString().padStart(2, '0');
        return `${hour}:${minute}`;
    });
    
    // APIからデータを取得
    const fetchShifts = useCallback(async () => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const res = await api.get(`/admin/shifts/${date}`); 
            
            const initialData: StaffShiftEntry[] = res.data.staff_shifts.map((staff: StaffShiftEntry) => ({
                ...staff,
                adjusted_shifts: staff.confirmed.length > 0 ? staff.confirmed : [{ 
                    id: 0, 
                    user_id: staff.user_id, 
                    // shop_idは確定APIに渡す際に不要なので0で仮置き
                    shop_id: 0, 
                    shift_date: date,
                    start_time: '00:00',
                    end_time: '00:00', 
                    shift_type: 'confirmed', 
                    user_name: staff.name
                }]
            }));
            
            setStaffData(initialData);

        } catch (err: any) {
            const errorMessage = err.response?.data?.error || "シフトデータの取得に失敗しました。";
            setError(errorMessage);
            setStaffData([]);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    // 手動調整フォームの変更をハンドル
    const handleAdjustmentChange = (
        staffUserId: number, 
        field: 'start_time' | 'end_time', 
        value: string
    ) => {
        setStaffData(prev => prev.map(staff => {
            if (staff.user_id !== staffUserId) return staff;
            const newAdjustedShifts = staff.adjusted_shifts.map((shift, index) => {
                if (index === 0) {
                    return { ...shift, [field]: value };
                }
                return shift;
            });
            return { ...staff, adjusted_shifts: newAdjustedShifts };
        }));
    };
    
    // シフト確定処理
    const handleConfirm = async () => {
        setMessage(null);
        setLoading(true);

        const shiftsToConfirm: Partial<ShiftData>[] = staffData
            .map(staff => staff.adjusted_shifts[0])
            .filter(shift => shift.start_time !== '00:00' && shift.end_time !== '00:00')
            .map(shift => ({
                user_id: shift.user_id,
                shift_date: shift.shift_date,
                start_time: shift.start_time,
                end_time: shift.end_time,
            }));
        
        if (shiftsToConfirm.length === 0) {
            setMessage("確定するシフトがありません。");
            setLoading(false);
            return;
        }

        try {
            const res = await api.post("/admin/shifts/confirm", { 
                confirmed_shifts: shiftsToConfirm 
            });
            setMessage(res.data.message || "シフト確定が完了しました。");
            fetchShifts(); 
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || "シフト確定に失敗しました。";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (loading && staffData.length === 0) return <p>シフトデータを読み込み中...</p>;
    
    // --- レンダリング部分 ---
    return (
        <div className="admin-shift-adjust-page" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <Link href={`/admin/day/${previousDate}`}>&lt; 前の日 ({previousDate})</Link>
                <h1>{date} のシフト調整・確定</h1>
                <Link href={`/admin/day/${nextDate}`}>次の日 ({nextDate}) &gt;</Link>
            </div>
            
            {error && <p style={{ color: 'red', fontWeight: 'bold' }}>エラー: {error}</p>}
            {message && <p style={{ color: 'green', fontWeight: 'bold' }}>{message}</p>}
            
            {staffData.length === 0 ? (
                <p>この日のシフト希望はありません。</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f4f4f4' }}>
                                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>スタッフ名</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>希望シフト</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', minWidth: '150px' }}>確定シフト (開始)</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', minWidth: '150px' }}>確定シフト (終了)</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>現在の確定</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffData.map((staff) => (
                                <tr key={staff.user_id}>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{staff.name}</td>
                                    
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        {staff.requests.length > 0 ? (
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                {staff.requests.map((req, i) => (
                                                    <li key={i}>{req.start_time} - {req.end_time}</li>
                                                ))}
                                            </ul>
                                        ) : '希望なし'}
                                    </td>
                                    
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        <select 
                                            value={staff.adjusted_shifts[0]?.start_time || '00:00'}
                                            onChange={(e) => handleAdjustmentChange(staff.user_id, 'start_time', e.target.value)}
                                            style={{ padding: '5px' }}
                                        >
                                            {TIME_OPTIONS.map(time => (
                                                <option key={`start-${time}`} value={time}>
                                                    {time}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                        <select 
                                            value={staff.adjusted_shifts[0]?.end_time || '00:00'}
                                            onChange={(e) => handleAdjustmentChange(staff.user_id, 'end_time', e.target.value)}
                                            style={{ padding: '5px' }}
                                        >
                                            {TIME_OPTIONS.map(time => (
                                                <option key={`end-${time}`} value={time}>
                                                    {time}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    
                                    <td style={{ padding: '10px', border: '1px solid #ddd', color: staff.confirmed.length > 0 ? 'blue' : 'gray' }}>
                                        {staff.confirmed.length > 0 ? 
                                            `${staff.confirmed[0].start_time} - ${staff.confirmed[0].end_time}` : 
                                            '未確定'
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    <button 
                        onClick={handleConfirm} 
                        disabled={loading}
                        style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                        {loading ? '確定中...' : `${date} のシフトを確定する`}
                    </button>
                </div>
            )}
            
            <Link href="/admin" style={{ display: 'block', marginTop: '30px' }}>カレンダーに戻る</Link>
        </div>
    );
}
// app/admin/day/[date]/_ShiftAdjustClient.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

// -------------------- 型定義 --------------------
interface ShiftData {
    id: number;
    user_id: number;
    shop_id: number;
    shift_date: string;
    start_time: string;
    end_time: string;
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

// 自動調整結果
interface AutoAssignment {
    user_id: number;
    start_time: string;
    end_time: string;
}

interface AutoAdjustMetrics {
    users: Record<string, { accepted: number; total: number; rate: number }>;
    overall: { accepted: number; total: number; rate: number };
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

const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// -------------------- クライアントコンポーネント --------------------
export default function ShiftAdjustClient({ date }: { date: string }) {
    const [staffData, setStaffData] = useState<StaffShiftEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // 自動調整
    const [autoAdjusting, setAutoAdjusting] = useState(false);
    const [autoMetrics, setAutoMetrics] = useState<AutoAdjustMetrics | null>(null);
    const [showMetrics, setShowMetrics] = useState(false);

    const previousDate = calculateDate(date, -1);
    const nextDate = calculateDate(date, 1);

    const TIME_OPTIONS = useMemo(() => Array.from({ length: 24 * 4 }, (_, i) => {
        const hour = Math.floor(i / 4).toString().padStart(2, '0');
        const minute = ((i % 4) * 15).toString().padStart(2, '0');
        return `${hour}:${minute}`;
    }), []);

    // APIからデータ取得
    const fetchShifts = useCallback(async () => {
        setLoading(true);
        setError(null);
        setMessage(null);
        setAutoMetrics(null);
        try {
            const res = await api.get(`/admin/shifts/${date}`);
            const initialData: StaffShiftEntry[] = res.data.staff_shifts.map((staff: StaffShiftEntry) => ({
                ...staff,
                adjusted_shifts: staff.confirmed.length > 0 ? staff.confirmed : [{
                    id: 0,
                    user_id: staff.user_id,
                    shop_id: 0,
                    shift_date: date,
                    start_time: staff.requests[0]?.start_time || '00:00',
                    end_time: staff.requests[0]?.end_time || '00:00',
                    shift_type: 'confirmed',
                    user_name: staff.name
                }]
            }));
            setStaffData(initialData);
        } catch (err: any) {
            setError(err.response?.data?.error || "シフトデータの取得に失敗しました。");
            setStaffData([]);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    // 手動調整変更
    const handleAdjustmentChange = (
        staffUserId: number,
        field: 'start_time' | 'end_time',
        value: string
    ) => {
        setStaffData(prev => prev.map(staff => {
            if (staff.user_id !== staffUserId) return staff;
            const newAdjustedShifts = staff.adjusted_shifts.map((shift, index) => {
                if (index === 0) return { ...shift, [field]: value };
                return shift;
            });
            return { ...staff, adjusted_shifts: newAdjustedShifts };
        }));
    };

    // ===== 自動調整（シミュレーション） =====
    const handleAutoAdjustPreview = async () => {
        setAutoAdjusting(true);
        setError(null);
        setMessage(null);
        try {
            const res = await api.post(`/admin/shifts/auto_adjust/${date}`, { apply: false });
            const assignments: AutoAssignment[] = res.data.assignments;
            const metrics: AutoAdjustMetrics = res.data.metrics;

            // staffDataの調整シフトを自動調整結果で更新
            setStaffData(prev => prev.map(staff => {
                const assignment = assignments.find(a => a.user_id === staff.user_id);
                if (assignment) {
                    return {
                        ...staff,
                        adjusted_shifts: [{
                            ...staff.adjusted_shifts[0],
                            start_time: assignment.start_time,
                            end_time: assignment.end_time,
                        }]
                    };
                }
                // 割り当てられなかったスタッフは休み扱い
                return {
                    ...staff,
                    adjusted_shifts: [{
                        ...staff.adjusted_shifts[0],
                        start_time: '00:00',
                        end_time: '00:00',
                    }]
                };
            }));

            setAutoMetrics(metrics);
            setShowMetrics(true);
            setMessage("✅ 自動調整の提案を表示しました。内容を確認して「シフトを確定する」を押してください。");
        } catch (err: any) {
            setError(err.response?.data?.error || "自動調整に失敗しました。");
        } finally {
            setAutoAdjusting(false);
        }
    };

    // ===== シフト確定処理 =====
    const handleConfirm = async () => {
        setMessage(null);
        setLoading(true);

        const shiftsToConfirm = staffData
            .map(staff => staff.adjusted_shifts[0])
            .filter(shift => shift.start_time !== '00:00' && shift.end_time !== '00:00')
            .map(shift => ({
                user_id: shift.user_id,
                shift_date: shift.shift_date,
                start_time: shift.start_time,
                end_time: shift.end_time,
            }));

        if (shiftsToConfirm.length === 0) {
            setMessage("確定するシフトがありません。（全員休みとして処理されます）");
            setLoading(false);
            return;
        }

        try {
            const res = await api.post("/admin/shifts/confirm", {
                confirmed_shifts: shiftsToConfirm
            });
            setMessage(res.data.message || "シフト確定が完了しました。");
            setAutoMetrics(null);
            fetchShifts();
        } catch (err: any) {
            setError(err.response?.data?.error || "シフト確定に失敗しました。");
        } finally {
            setLoading(false);
        }
    };

    // -------------------- ガントチャート --------------------
    const timeHeaders = useMemo(() => {
        const headers = [];
        for (let h = 8; h <= 22; h++) {
            headers.push(`${h.toString().padStart(2, '0')}:00`);
        }
        return headers;
    }, []);

    const calculateShiftBar = (shift: ShiftData | undefined) => {
        if (!shift || (shift.start_time === '00:00' && shift.end_time === '00:00')) {
            return { width: '0%', marginLeft: '0%' };
        }
        const totalMinutesInView = (22 - 8) * 60;
        const startOfViewInMinutes = 8 * 60;
        const startMin = timeToMinutes(shift.start_time);
        const endMin = timeToMinutes(shift.end_time);
        const actualStartMin = Math.max(startMin, startOfViewInMinutes);
        const actualEndMin = Math.min(endMin, 22 * 60);
        const durationMin = actualEndMin - actualStartMin;
        const offsetMin = actualStartMin - startOfViewInMinutes;
        const width = (durationMin / totalMinutesInView) * 100;
        const marginLeft = (offsetMin / totalMinutesInView) * 100;
        if (durationMin <= 0) return { width: '0%', marginLeft: '0%' };
        return {
            width: `${Math.max(width, 0.5)}%`,
            marginLeft: `${Math.max(marginLeft, 0)}%`,
        };
    };

    if (loading && staffData.length === 0) return (
        <div className="p-8 text-center text-indigo-600 font-semibold">
            シフトデータを読み込み中...
        </div>
    );

    // ---- レンダリング ----
    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-lg p-6 border border-gray-200">

                {/* ヘッダー */}
                <div className="flex justify-between items-center border-b pb-4 mb-6">
                    <Link href={`/admin/day/${previousDate}`} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition duration-150 font-bold">
                        &larr; 前の日
                    </Link>
                    <h1 className="text-2xl font-extrabold text-gray-900">
                        {format(parseISO(date), 'yyyy年M月d日 (eee)', { locale: ja })} のシフト調整・確定
                    </h1>
                    <Link href={`/admin/day/${nextDate}`} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition duration-150 font-bold">
                        次の日 &rarr;
                    </Link>
                </div>

                {/* メッセージ */}
                {error && <div className="p-3 mb-4 text-red-700 bg-red-100 border border-red-300 rounded-md font-bold">エラー: {error}</div>}
                {message && <div className="p-3 mb-4 text-green-700 bg-green-100 border border-green-300 rounded-md font-bold">{message}</div>}

                {/* ===== 自動調整ボタンエリア ===== */}
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-indigo-800">🤖 シフト自動調整</p>
                        <p className="text-xs text-indigo-600 mt-0.5">
                            設定済みの優先度・定員に基づいて、最適なシフトを自動提案します。
                        </p>
                    </div>
                    <button
                        onClick={handleAutoAdjustPreview}
                        disabled={autoAdjusting || loading}
                        className="shrink-0 py-2 px-6 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:bg-gray-400 transition duration-150 shadow-md"
                    >
                        {autoAdjusting ? "⏳ 計算中..." : "✨ 自動調整を提案"}
                    </button>
                </div>

                {/* ===== 自動調整メトリクス ===== */}
                {showMetrics && autoMetrics && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-amber-800">📊 自動調整 結果サマリー</p>
                            <button
                                onClick={() => setShowMetrics(false)}
                                className="text-xs text-amber-600 hover:text-amber-800"
                            >
                                閉じる ×
                            </button>
                        </div>

                        {/* 全体棄却率 */}
                        <div className="mb-3 p-3 bg-white rounded-lg border border-amber-200">
                            <p className="text-xs text-gray-500 mb-1">全体の希望採用率</p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-200 rounded-full h-3">
                                    <div
                                        className="h-3 rounded-full bg-green-500 transition-all duration-500"
                                        style={{ width: `${(autoMetrics.overall.rate * 100).toFixed(0)}%` }}
                                    />
                                </div>
                                <span className="text-sm font-bold text-gray-700 shrink-0">
                                    {(autoMetrics.overall.rate * 100).toFixed(0)}%
                                    <span className="text-xs font-normal text-gray-400 ml-1">
                                        ({autoMetrics.overall.accepted}/{autoMetrics.overall.total}件)
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* スタッフ別 */}
                        <div className="space-y-2">
                            {Object.entries(autoMetrics.users).map(([uid, stats]) => {
                                const staff = staffData.find(s => s.user_id === parseInt(uid));
                                const pct = (stats.rate * 100).toFixed(0);
                                return (
                                    <div key={uid} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-600 w-20 shrink-0 truncate">
                                            {staff?.name ?? `ID:${uid}`}
                                        </span>
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-500 ${
                                                    stats.rate >= 0.8 ? 'bg-green-400' :
                                                    stats.rate >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500 w-16 text-right shrink-0">
                                            {pct}% ({stats.accepted}/{stats.total})
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {staffData.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 border border-dashed rounded-lg">
                        この日のシフト希望はありません。
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300 border border-gray-300">
                                <thead className="bg-gray-700 text-white">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-sm font-semibold w-1/5">スタッフ名</th>
                                        <th className="py-3 px-4 text-left text-sm font-semibold w-1/5">希望シフト</th>
                                        <th className="py-3 px-4 text-left text-sm font-semibold w-2/5">ガントチャート (8:00 - 22:00)</th>
                                        <th className="py-3 px-4 text-left text-sm font-semibold w-1/5">確定時間</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {staffData.map((staff) => {
                                        const request = staff.requests[0];
                                        const adjusted = staff.adjusted_shifts[0];
                                        const confirmed = staff.confirmed[0];
                                        const requestStyle = calculateShiftBar(request);
                                        const adjustedStyle = calculateShiftBar(adjusted);

                                        return (
                                            <tr key={staff.user_id} className="hover:bg-indigo-50 transition duration-100">
                                                <td className="py-4 px-4 text-sm font-medium text-gray-900 whitespace-nowrap border-r border-gray-200">
                                                    {staff.name} <span className="text-xs text-gray-500">({staff.role})</span>
                                                </td>
                                                <td className="py-4 px-4 text-sm text-yellow-700 font-semibold whitespace-nowrap border-r border-gray-200">
                                                    {request ? `${request.start_time.substring(0, 5)} - ${request.end_time.substring(0, 5)}` : 'なし'}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-500 border-r border-gray-200">
                                                    <div className="relative h-10 w-full bg-gray-100 rounded-lg border border-gray-300">
                                                        <div className="absolute inset-0 flex divide-x divide-gray-300/50 pointer-events-none">
                                                            {timeHeaders.slice(0, -1).map((_, i) => (
                                                                <div key={i} className="flex-1"></div>
                                                            ))}
                                                        </div>
                                                        {request && (
                                                            <div
                                                                className="absolute top-1/2 -translate-y-1/2 h-4 bg-yellow-300/50 rounded-md z-10 opacity-70"
                                                                style={{ width: requestStyle.width, marginLeft: requestStyle.marginLeft }}
                                                                title={`希望: ${request.start_time} - ${request.end_time}`}
                                                            />
                                                        )}
                                                        {adjusted && adjusted.start_time !== '00:00' && (
                                                            <div
                                                                className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-md z-20 transition duration-300 ${
                                                                    confirmed ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700 cursor-move'
                                                                }`}
                                                                style={{ width: adjustedStyle.width, marginLeft: adjustedStyle.marginLeft }}
                                                                title={`確定/調整: ${adjusted.start_time} - ${adjusted.end_time}`}
                                                            >
                                                                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white px-2 truncate">
                                                                    {adjusted.start_time.substring(0, 5)} - {adjusted.end_time.substring(0, 5)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                        {timeHeaders.map((time, i) => (
                                                            <span key={i} className="w-0 text-center relative -ml-2">{time}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-sm whitespace-nowrap">
                                                    <div className="flex flex-col space-y-1">
                                                        <select
                                                            value={adjusted?.start_time || '00:00'}
                                                            onChange={(e) => handleAdjustmentChange(staff.user_id, 'start_time', e.target.value)}
                                                            className="p-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                        >
                                                            {TIME_OPTIONS.map(time => (
                                                                <option key={`adj-start-${staff.user_id}-${time}`} value={time}>
                                                                    {time === '00:00' ? '休み' : time}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={adjusted?.end_time || '00:00'}
                                                            onChange={(e) => handleAdjustmentChange(staff.user_id, 'end_time', e.target.value)}
                                                            className="p-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                        >
                                                            {TIME_OPTIONS.map(time => (
                                                                <option key={`adj-end-${staff.user_id}-${time}`} value={time}>
                                                                    {time === '00:00' ? '休み' : time}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <span className={`text-xs mt-1 font-semibold ${confirmed ? 'text-green-600' : 'text-gray-500'}`}>
                                                            {confirmed
                                                                ? `確定済: ${confirmed.start_time.substring(0, 5)} - ${confirmed.end_time.substring(0, 5)}`
                                                                : '未確定'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* 確定ボタン */}
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className="w-full sm:w-auto py-3 px-8 border border-transparent rounded-lg shadow-lg text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 transition duration-150"
                            >
                                {loading ? '確定中...' : `${format(parseISO(date), 'M/d')} のシフトを確定する`}
                            </button>
                        </div>
                    </>
                )}

                <Link href="/admin" className="block text-center mt-10 text-indigo-600 hover:text-indigo-800 transition duration-150 font-medium">
                    &larr; カレンダーに戻る
                </Link>
            </div>
        </div>
    );
}

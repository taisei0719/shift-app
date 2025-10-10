// frontend/app/staff/shift_input/[date]/page.tsx
"use client";

import React, { useState } from "react";
import { api } from "../../../../lib/api"; // 相対パスに注意
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ShiftInputPage() {
    const params = useParams();
    const date = params.date as string; // ★ 修正点1: URLから日付を取得
    
    // 複数シフトのフォーム状態（シンプル化のため、hoursのselectは一旦使わへんよ）
    const [shifts, setShifts] = useState([{ start: "09:00", end: "17:00" }]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false); 

    // シフト希望を追加する関数
    const addShift = () => {
        setShifts([...shifts, { start: "09:00", end: "17:00" }]);
    };

    // シフト希望を削除する関数
    const removeShift = (index: number) => {
        const newShifts = shifts.filter((_, i) => i !== index);
        setShifts(newShifts);
    };

    // 特定のシフトの時間を更新する関数
    const updateShift = (index: number, field: 'start' | 'end', value: string) => {
        const newShifts = shifts.map((shift, i) => 
            i === index ? { ...shift, [field]: value } : shift
        );
        setShifts(newShifts);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(`${date} のシフトを提出中...`);

        const submitRequests = shifts.map(s => ({
            date: date,
            start: s.start, // ★ 修正: start_time -> start
            end: s.end,     // ★ 修正: end_time -> end
        }));

        try {
            // ★ 修正3: APIエンドポイントを /api/shifts/submit_request に修正
            const res = await api.post("/shifts/submit_request", { requests: submitRequests });
            
            setMessage(res.data.message);
            // 成功したらフォームをリセット (提出済みのデータを取得して表示する機能がない場合はこのままでOK)
            setShifts([{ start: "09:00", end: "17:00" }]); 

        } catch (err: any) {
            const errorMsg = err.response?.data?.error || "提出に失敗しました";
            setMessage(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="shift-input-container">
            <h1>{date} のシフト希望提出</h1>
            {message && <p style={{ color: message.includes("失敗") ? "red" : "green" }}>{message}</p>}
            <form onSubmit={handleSubmit}>
                {shifts.map((shift, index) => (
                    <div key={index} style={{ marginBottom: '10px', border: '1px solid #ccc', padding: '10px' }}>
                        <p>シフト希望 {index + 1}</p>
                        <label>
                            開始時間:
                            <input 
                                type="time" 
                                value={shift.start} 
                                onChange={(e) => updateShift(index, 'start', e.target.value)} 
                                required 
                            />
                        </label>
                        <label style={{ marginLeft: '10px' }}>
                            終了時間:
                            <input 
                                type="time" 
                                value={shift.end} 
                                onChange={(e) => updateShift(index, 'end', e.target.value)} 
                                required 
                            />
                        </label>
                        {shifts.length > 1 && (
                            <button type="button" onClick={() => removeShift(index)} style={{ marginLeft: '10px' }}>
                                削除
                            </button>
                        )}
                    </div>
                ))}

                <button type="button" onClick={addShift} style={{ marginTop: '10px' }}>
                    + シフト希望を追加
                </button>
                <br /><br />
                <button type="submit">この日のシフトを提出</button>
            </form>
            
            <Link href="/shifts" style={{ display: 'block', marginTop: '20px' }}>
                カレンダーに戻る
            </Link>
        </div>
    );
}
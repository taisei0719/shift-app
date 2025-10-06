"use client";
import { useState } from "react";
import { api } from "../../lib/api";

export default function StaffPage() {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmitShift = async () => {
    try {
      const res = await api.post("/shift_input", {
        date,
        start_time: startTime,
        end_time: endTime,
      });
      setMessage(res.data.message);
    } catch (err: any) {
      setMessage(err.response?.data?.error || "提出失敗");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">シフト提出</h1>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border mb-2"/>
      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border mb-2"/>
      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border mb-2"/>
      <button onClick={handleSubmitShift} className="w-full bg-green-500 text-white p-2">提出</button>
      {message && <p className="mt-2 text-red-500">{message}</p>}
    </div>
  );
}

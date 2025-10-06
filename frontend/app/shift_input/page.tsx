// frontend/pages/shift_input.js
import React, { useState } from "react";
import { api } from "../lib/axios";
import Layout from "../components/Layout";

export default function ShiftInput({ user }) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:00");
  const [message, setMessage] = useState("");

  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8~22時

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/shift_input", { date, start_time: startTime, end_time: endTime });
      setMessage("シフト提出成功");
    } catch (err) {
      setMessage(err.response?.data?.error || "提出に失敗しました");
    }
  };

  return (
    <Layout user={user}>
      <h1>シフト提出</h1>
      {message && <p style={{ color: "green" }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          日付: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <br />
        <label>
          勤務開始時刻:
          <select value={startTime} onChange={(e) => setStartTime(e.target.value)} required>
            {hours.map(h => (
              <React.Fragment key={h}>
                <option value={`${h.toString().padStart(2, '0')}:00`}>{`${h.toString().padStart(2, '0')}:00`}</option>
                <option value={`${h.toString().padStart(2, '0')}:30`}>{`${h.toString().padStart(2, '0')}:30`}</option>
              </React.Fragment>
            ))}
          </select>
        </label>
        <br />
        <label>
          勤務終了時刻:
          <select value={endTime} onChange={(e) => setEndTime(e.target.value)} required>
            {hours.map(h => (
              <React.Fragment key={h}>
                <option value={`${h.toString().padStart(2, '0')}:00`}>{`${h.toString().padStart(2, '0')}:00`}</option>
                <option value={`${h.toString().padStart(2, '0')}:30`}>{`${h.toString().padStart(2, '0')}:30`}</option>
              </React.Fragment>
            ))}
          </select>
        </label>
        <br />
        <button type="submit">送信</button>
      </form>
    </Layout>
  );
}
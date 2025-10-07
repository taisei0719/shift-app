"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import axios from "axios";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function AdminDay({ params }: { params: { date: string } }) {
  const date = params.date;
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`http://localhost:5000/api/admin/day/${date}`, { withCredentials: true })
      .then((res) => setSchedule(res.data.schedule || {}))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) return <p>読み込み中...</p>;

  const data = [];
  Object.entries(schedule).forEach(([name, shifts]) => {
    shifts.forEach((s) => {
      const [start, end] = s.split("-");
      const startISO = `${date}T${start}`;
      const endISO = `${date}T${end}`;
      data.push({
        type: "bar",
        x: [new Date(endISO).getTime() - new Date(startISO).getTime()],
        y: [name],
        base: new Date(startISO).getTime(),
        orientation: "h",
        name,
        width: 0.1,
        hovertext: `${start} - ${end}`,
        hoverinfo: "text",
      });
    });
  });

  return (
    <>
      <h1>{date} のシフト一覧</h1>
      {data.length > 0 ? (
        <Plot data={data} layout={{ title: `${date} のシフト希望`, xaxis: { type: "date" }, yaxis: { automargin: true } }} style={{ width: "100%", height: "600px" }} />
      ) : (
        <p>シフトデータがありません</p>
      )}
      <Link href="/admin">カレンダーに戻る</Link>
    </>
  );
}


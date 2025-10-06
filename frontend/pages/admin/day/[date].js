// frontend/pages/admin/day/[date].js
import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Layout from "../../../components/Layout";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function AdminDay({ date, schedule, user, shop }) {
  const data = [];

  Object.entries(schedule).forEach(([name, shifts]) => {
    shifts.forEach((s) => {
      const [start, end] = s.split("-");
      const startISO = `${date}T${start}`;
      const endISO = `${date}T${end}`;
      data.push({
        type: "bar",
        x: [new Date(endISO) - new Date(startISO)],
        y: [name],
        base: new Date(startISO),
        orientation: "h",
        name,
        width: 0.1,
        hovertext: `${start} - ${end}`,
        hoverinfo: "text"
      });
    });
  });

  const layout = {
    barmode: "stack",
    title: `${date} のシフト希望`,
    xaxis: { title: "時間", type: "date", tickformat: "%H:%M" },
    yaxis: { title: "スタッフ", automargin: true },
    bargap: 0.4,
    bargroupgap: 0.2,
    margin: { l: 100 }
  };

  return (
    <Layout user={user} shop={shop}>
      <h1>{date} のシフト一覧</h1>
      <Plot data={data} layout={layout} style={{ width: "100%", height: "600px" }} />
      <Link href="/admin">カレンダーに戻る</Link>
    </Layout>
  );
}

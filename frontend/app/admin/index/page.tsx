// frontend/pages/admin/index.js
import React from "react";
import Link from "next/link";
import Layout from "../../../components/Layout";

export default function AdminCalendar({ year, month, prevYear, prevMonth, nextYear, nextMonth, days, user, shop }) {
  return (
    <Layout user={user} shop={shop}>
      <h1>{year}年 {month}月</h1>

      <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 0" }}>
        <Link href={`/admin?year=${prevYear}&month=${prevMonth}`}>← 前の月</Link>
        <Link href={`/admin?year=${nextYear}&month=${nextMonth}`}>次の月 →</Link>
      </div>

      <table border="1">
        <tbody>
          {Array.from({ length: Math.ceil(days.length / 7) }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {days.slice(rowIndex * 7, rowIndex * 7 + 7).map((day) => (
                <td key={day.day}>
                  {day.day}
                  <br />
                  {day.month === month ? (
                    <Link href={`/admin/day/${day.dateStr}`}>詳細</Link>
                  ) : (
                    <span style={{ color: "gray" }}>詳細</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
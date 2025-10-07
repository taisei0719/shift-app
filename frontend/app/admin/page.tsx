"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Day {
  day: number | "";
  month: number;
  dateStr: string;
}

interface AdminCalendarProps {
  year?: number;
  month?: number;
  prevYear?: number;
  prevMonth?: number;
  nextYear?: number;
  nextMonth?: number;
  days?: Day[];
  user?: any;
  shop?: any;
}

export default function AdminCalendar({
  days = [],
}: { days?: Day[] }) {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1;

  // 前月・次月計算
  const prevDate = new Date(year, month - 2);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  const nextDate = new Date(year, month);
  const nextYear = nextDate.getFullYear();
  const nextMonth = nextDate.getMonth() + 1;

  // カレンダー自動生成
  const generateDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysArray: Day[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      daysArray.push({ day: "", month: month - 1, dateStr: "" });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      daysArray.push({ day: d, month, dateStr });
    }

    while (daysArray.length % 7 !== 0) {
      daysArray.push({ day: "", month: month + 1, dateStr: "" });
    }

    return daysArray;
  };
  const calendarDays = days.length ? days : generateDays(year, month);

  return (
    <>
      <h1>{year}年 {month}月</h1>

      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", margin: "10px 0" }}>
        <Link href={`/admin?year=${prevYear}&month=${prevMonth}`}>← 前の月</Link>
        <Link href={`/admin?year=${nextYear}&month=${nextMonth}`}>次の月 →</Link>
      </div>

      <table border={1} style={{ width: "100%", textAlign: "center" }}>
        <tbody>
          {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {calendarDays.slice(rowIndex * 7, rowIndex * 7 + 7).map((day, idx) => (
                <td key={day.dateStr || idx}>
                  {day.day || ""}
                  <br />
                  {day.month === month && day.day ? (
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
    </>
  );
}

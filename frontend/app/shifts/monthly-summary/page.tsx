// frontend/app/shifts/monthly-summary/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/app/context/UserContext';
import { api } from '@/lib/api';
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';

// -------------------- 型定義 --------------------
interface ShiftData {
  id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: 'request' | 'confirmed';
}

interface ShiftsByDate {
  [date: string]: ShiftData[];
}

// -------------------- 時間→分 --------------------
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const formatDuration = (start: string, end: string) => {
  const diff = toMinutes(end) - toMinutes(start);
  if (diff <= 0) return '0h';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
};

// -------------------- 内部コンポーネント --------------------
function MonthlySummaryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const now = new Date();
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

  const currentDate = useMemo(() => new Date(year, month - 1, 1), [year, month]);

  const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 月移動
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevLink = `/shifts/monthly-summary?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`;
  const nextLink = `/shifts/monthly-summary?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`;

  const fetchShifts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/shifts/month/${year}/${month}`);
      setShiftsByDate(res.data.shifts_by_date || {});
    } catch {
      setError('シフトデータの取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, [user, year, month]);

  useEffect(() => {
    if (user) fetchShifts();
  }, [fetchShifts, user]);

  // 全日付リスト（当月）
  const allDays = useMemo(() =>
    eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }),
    [currentDate]
  );

  // 確定シフトのある日だけ抽出
  const confirmedDays = useMemo(() => {
    return allDays
      .map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const shifts = shiftsByDate[dateStr] ?? [];
        const confirmed = shifts.find(s => s.shift_type === 'confirmed');
        return confirmed ? { date: d, dateStr, shift: confirmed } : null;
      })
      .filter(Boolean) as { date: Date; dateStr: string; shift: ShiftData }[];
  }, [allDays, shiftsByDate]);

  // 月合計労働時間
  const totalMinutes = useMemo(() => {
    return confirmedDays.reduce((sum, { shift }) => {
      if (shift.start_time === '00:00') return sum;
      return sum + toMinutes(shift.end_time) - toMinutes(shift.start_time);
    }, 0);
  }, [confirmedDays]);

  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  // 希望提出済みの件数
  const requestCount = useMemo(() => {
    return allDays.filter(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return (shiftsByDate[dateStr] ?? []).some(s => s.shift_type === 'request');
    }).length;
  }, [allDays, shiftsByDate]);

  const workDays = confirmedDays.filter(d => d.shift.start_time !== '00:00').length;
  const offDays = confirmedDays.filter(d => d.shift.start_time === '00:00').length;

  // ---------- UI ----------
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ===== ヘッダー ===== */}
        <div className="bg-indigo-700 text-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-1">
            <Link href={prevLink} className="p-2 rounded-lg hover:bg-indigo-600 transition font-bold text-xl">‹</Link>
            <div className="text-center">
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-0.5">Monthly Shift</p>
              <h1 className="text-2xl font-bold">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h1>
              <p className="text-indigo-200 text-sm mt-0.5">{user?.user_name} さんのシフト</p>
            </div>
            <Link href={nextLink} className="p-2 rounded-lg hover:bg-indigo-600 transition font-bold text-xl">›</Link>
          </div>
        </div>

        {/* ===== サマリーカード ===== */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{workDays}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">勤務日数</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {totalHours}<span className="text-sm font-normal">h</span>
              {totalMins > 0 && <>{totalMins}<span className="text-sm font-normal">m</span></>}
            </p>
            <p className="text-xs text-gray-400 mt-1 font-medium">合計労働時間</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{requestCount}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">希望提出日数</p>
          </div>
        </div>

        {/* ===== エラー ===== */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* ===== 確定シフト一覧 ===== */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800">確定シフト一覧</h2>
            {offDays > 0 && (
              <span className="text-xs text-gray-400">休日確定 {offDays}日含む</span>
            )}
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">読み込み中...</div>
          ) : confirmedDays.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-gray-400 text-sm">この月の確定シフトはまだありません</p>
              <Link
                href={`/shifts?year=${year}&month=${month}`}
                className="inline-block mt-4 text-indigo-500 text-xs hover:underline"
              >
                カレンダーで希望を提出する →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {confirmedDays.map(({ date, dateStr, shift }) => {
                const isOff = shift.start_time === '00:00';
                const dow = date.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const duration = isOff ? null : formatDuration(shift.start_time, shift.end_time);

                return (
                  <li key={dateStr}>
                    <Link
                      href={`/shifts/${dateStr}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition group"
                    >
                      {/* 日付 */}
                      <div className={`w-12 text-center shrink-0 ${isWeekend ? (dow === 0 ? 'text-red-500' : 'text-blue-500') : 'text-gray-700'}`}>
                        <p className="text-lg font-bold leading-none">{format(date, 'd')}</p>
                        <p className="text-xs font-medium mt-0.5">{format(date, 'eee', { locale: ja })}</p>
                      </div>

                      {/* シフト情報 */}
                      <div className="flex-1 min-w-0">
                        {isOff ? (
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏖️</span>
                            <span className="text-sm font-medium text-gray-500">休日</span>
                          </div>
                        ) : (
                          <div>
                            <p className="text-base font-bold text-gray-800">
                              {shift.start_time.slice(0, 5)}
                              <span className="text-gray-400 font-normal mx-1 text-sm">〜</span>
                              {shift.end_time.slice(0, 5)}
                            </p>
                            {duration && (
                              <p className="text-xs text-gray-400 mt-0.5">{duration}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* バッジ */}
                      {!isOff && (
                        <span className="shrink-0 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                          確定
                        </span>
                      )}

                      <span className="text-gray-300 group-hover:text-gray-500 transition text-sm">›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ===== 希望提出状況サマリー ===== */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800">希望提出状況</h2>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">読み込み中...</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {allDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const shifts = shiftsByDate[dateStr] ?? [];
                const confirmed = shifts.find(s => s.shift_type === 'confirmed');
                const request = shifts.find(s => s.shift_type === 'request');
                if (!request && !confirmed) return null;

                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;

                return (
                  <li key={dateStr} className="flex items-center gap-4 px-6 py-3">
                    <div className={`w-12 text-center shrink-0 ${isWeekend ? (dow === 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-500'}`}>
                      <p className="text-sm font-bold">{format(day, 'd')}</p>
                      <p className="text-xs">{format(day, 'eee', { locale: ja })}</p>
                    </div>

                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      {/* 希望 */}
                      {request && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${request.start_time === '00:00' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                          {request.start_time === '00:00' ? '休み希望' : `希望 ${request.start_time.slice(0, 5)}〜${request.end_time.slice(0, 5)}`}
                        </span>
                      )}
                      {/* 確定 */}
                      {confirmed && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${confirmed.start_time === '00:00' ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                          {confirmed.start_time === '00:00' ? '休み確定' : `確定 ${confirmed.start_time.slice(0, 5)}〜${confirmed.end_time.slice(0, 5)}`}
                        </span>
                      )}
                      {/* ズレ警告 */}
                      {request && confirmed && request.start_time !== '00:00' && confirmed.start_time !== '00:00' &&
                        (request.start_time !== confirmed.start_time || request.end_time !== confirmed.end_time) && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600">
                            ⚠️ 調整あり
                          </span>
                        )
                      }
                    </div>
                  </li>
                );
              }).filter(Boolean)}

              {!isLoading && allDays.every(d => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const shifts = shiftsByDate[dateStr] ?? [];
                return shifts.length === 0;
              }) && (
                <li className="py-10 text-center text-gray-400 text-sm">
                  提出済みの希望シフトがありません
                </li>
              )}
            </ul>
          )}
        </div>

        {/* ===== 戻るリンク ===== */}
        <div className="text-center pb-4">
          <Link
            href="/shifts"
            className="text-indigo-500 text-sm hover:underline font-medium"
          >
            ← カレンダーに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

// Suspenseでラップ（useSearchParams使用のため必須）
export default function MonthlySummaryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    }>
      <MonthlySummaryContent />
    </Suspense>
  );
}

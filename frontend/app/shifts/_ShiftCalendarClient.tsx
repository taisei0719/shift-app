// frontend/app/shifts/_ShiftCalendarClient.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/context/UserContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from "@/lib/api";
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

interface Props {
  initialYear: number;
  initialMonth: number;
}

// -------------------- ヘルパー --------------------
const timeOptions = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 30)
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  return Array.from(new Set([...opts, '00:00'])).sort();
})();

// -------------------- メインコンポーネント --------------------
export default function ShiftCalendarClient({ initialYear, initialMonth }: Props) {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [currentDate, setCurrentDate] = useState(new Date(initialYear, initialMonth - 1, 1));
  const [shiftsByDate, setShiftsByDate] = useState<ShiftsByDate>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 選択中の日付・パネルモード
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'detail' | 'form'>('detail');

  // シフト提出フォーム
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isDayOff, setIsDayOff] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const isAdmin = user?.role === 'admin';

  // ---------- データ取得 ----------
  const fetchShifts = useCallback(async (y: number, m: number) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/shifts/month/${y}/${m}`);
      setShiftsByDate(res.data.shifts_by_date || {});
    } catch (err: any) {
      setError('データの取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchShifts(year, month);
  }, [year, month, fetchShifts, user]);

  // ---------- カレンダー計算 ----------
  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  }, [currentDate]);

  const startingDayOfWeek = daysInMonth[0].getDay();

  // ---------- 日付クリック ----------
  const handleDayClick = (dateObj: Date) => {
    const dateStr = format(dateObj, 'yyyy-MM-dd');
    const isPast = dateObj.getTime() < new Date().setHours(0, 0, 0, 0);

    setSelectedDate(dateStr);
    setSubmitMessage(null);

    // 過去・今日は詳細表示、未来は提出フォーム
    const shifts = shiftsByDate[dateStr] ?? [];
    const hasShift = shifts.length > 0;

    if (hasShift) {
      // シフトがあれば詳細表示
      setPanelMode('detail');
    } else if (!isPast) {
      // 未来でシフトなし → 提出フォーム
      setPanelMode('form');
    } else {
      setPanelMode('detail');
    }

    // フォームの初期値をセット
    const req = shifts.find(s => s.shift_type === 'request');
    if (req && req.start_time !== '00:00') {
      setStartTime(req.start_time.substring(0, 5));
      setEndTime(req.end_time.substring(0, 5));
      setIsDayOff(false);
    } else if (req && req.start_time === '00:00') {
      setIsDayOff(true);
      setStartTime('00:00');
      setEndTime('00:00');
    } else {
      setStartTime('09:00');
      setEndTime('17:00');
      setIsDayOff(false);
    }
  };

  // ---------- シフト提出 ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    setSubmitting(true);
    setSubmitMessage(null);

    try {
      await api.post('/shifts/submit_request', {
        requests: [{
          date: selectedDate,
          start: isDayOff ? '00:00' : startTime,
          end: isDayOff ? '00:00' : endTime,
        }],
      });
      setSubmitMessage('✅ シフト希望を提出しました！');
      await fetchShifts(year, month);
      // 提出後は詳細モードに切替
      setPanelMode('detail');
    } catch (err: any) {
      setSubmitMessage(`❌ 失敗: ${err.response?.data?.error ?? 'サーバーエラー'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- セルのシフト情報 ----------
  const getShiftBadge = (dateStr: string) => {
    const shifts = shiftsByDate[dateStr];
    if (!shifts || shifts.length === 0) return null;

    const confirmed = shifts.find(s => s.shift_type === 'confirmed');
    if (confirmed) {
      const isOff = confirmed.start_time === '00:00';
      return (
        <div className={`text-xs font-semibold truncate rounded px-1 py-0.5 mt-1 ${isOff ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
          {isOff ? '休確定' : `${confirmed.start_time.slice(0, 5)}〜`}
        </div>
      );
    }

    const request = shifts.find(s => s.shift_type === 'request');
    if (request) {
      const isOff = request.start_time === '00:00';
      return (
        <div className={`text-xs font-medium truncate rounded px-1 py-0.5 mt-1 ${isOff ? 'bg-gray-100 text-gray-400' : 'bg-amber-100 text-amber-700'}`}>
          {isOff ? '休希望' : `${request.start_time.slice(0, 5)}〜`}
        </div>
      );
    }
    return null;
  };

  // ---------- 詳細パネルの内容 ----------
  const renderDetailPanel = () => {
    if (!selectedDate) return null;
    const dateObj = parseISO(selectedDate);
    const shifts = shiftsByDate[selectedDate] ?? [];
    const confirmed = shifts.find(s => s.shift_type === 'confirmed');
    const request = shifts.find(s => s.shift_type === 'request');
    const isPast = dateObj.getTime() < new Date().setHours(0, 0, 0, 0);

    return (
      <div className="space-y-4">
        <h3 className="text-base font-bold text-gray-800 border-b pb-2">
          {format(dateObj, 'M月d日 (eee)', { locale: ja })} のシフト
        </h3>

        {/* 確定シフト */}
        {confirmed ? (
          <div className={`rounded-xl border-2 p-4 ${confirmed.start_time === '00:00' ? 'bg-gray-50 border-gray-200' : 'bg-emerald-50 border-emerald-300'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{confirmed.start_time === '00:00' ? '🏖️' : '✅'}</span>
              <span className="text-sm font-bold text-gray-700">確定シフト</span>
            </div>
            {confirmed.start_time === '00:00' ? (
              <p className="text-sm text-gray-500 font-medium">この日は休みです</p>
            ) : (
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {confirmed.start_time.slice(0, 5)}
                <span className="text-base font-normal text-gray-400 mx-2">〜</span>
                {confirmed.end_time.slice(0, 5)}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center">
            <p className="text-sm text-gray-400">確定シフトなし</p>
          </div>
        )}

        {/* 希望シフト */}
        {request ? (
          <div className={`rounded-xl border p-4 ${request.start_time === '00:00' ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{request.start_time === '00:00' ? '😴' : '⏳'}</span>
              <span className="text-sm font-semibold text-gray-600">提出済み希望</span>
              <span className="text-xs text-gray-400 ml-auto">未確定</span>
            </div>
            {request.start_time === '00:00' ? (
              <p className="text-sm text-gray-500">休み希望を提出済み</p>
            ) : (
              <p className="text-xl font-bold text-amber-700 mt-1">
                {request.start_time.slice(0, 5)}
                <span className="text-sm font-normal text-gray-400 mx-2">〜</span>
                {request.end_time.slice(0, 5)}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-400">希望未提出</p>
          </div>
        )}

        {/* 未来の日付 → 提出フォームに切り替えボタン */}
        {!isPast && (
          <button
            onClick={() => setPanelMode('form')}
            className="w-full mt-2 py-2 px-4 border-2 border-indigo-400 text-indigo-600 text-sm font-semibold rounded-lg hover:bg-indigo-50 transition duration-150"
          >
            {request ? '✏️ 希望シフトを修正する' : '＋ 希望シフトを提出する'}
          </button>
        )}
      </div>
    );
  };

  // ---------- 提出フォームパネル ----------
  const renderFormPanel = () => {
    if (!selectedDate) return null;
    const dateObj = parseISO(selectedDate);

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-bold text-gray-800">
            {format(dateObj, 'M月d日 (eee)', { locale: ja })} の希望提出
          </h3>
          <button
            type="button"
            onClick={() => setPanelMode('detail')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← 詳細に戻る
          </button>
        </div>

        {submitMessage && (
          <p className={`text-sm text-center font-semibold p-2 rounded-lg ${submitMessage.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {submitMessage}
          </p>
        )}

        {/* 休み希望チェック */}
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer border border-gray-200 hover:border-indigo-300 transition">
          <input
            type="checkbox"
            checked={isDayOff}
            onChange={(e) => {
              setIsDayOff(e.target.checked);
              if (e.target.checked) { setStartTime('00:00'); setEndTime('00:00'); }
              else { setStartTime('09:00'); setEndTime('17:00'); }
            }}
            className="w-5 h-5 text-indigo-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700">🏖️ この日は休みを希望する</span>
        </label>

        {/* 時間入力 */}
        {!isDayOff && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">開始時刻</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
              >
                {timeOptions.filter(t => t !== '00:00').map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">終了時刻</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
              >
                {timeOptions.filter(t => t !== '00:00').map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:bg-gray-400 transition duration-150 shadow-md"
        >
          {submitting ? '提出中...' : '希望シフトを提出する'}
        </button>
      </form>
    );
  };

  // ---------- 店舗未所属 ----------
  if (!userLoading && user && !user.shop_id) {
    const registerPath = isAdmin ? '/shop_register' : '/staff_shop_register';
    return (
      <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
        <div className="w-full max-w-lg p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200 text-center">
          <h1 className="text-2xl font-bold text-gray-900">店舗未登録</h1>
          <p className="text-gray-600">店舗を登録してシフトを提出しましょう！</p>
          <button onClick={() => router.push(registerPath)} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 transition">
            {isAdmin ? '店舗登録ページへ' : '店舗参加（コード入力）へ'}
          </button>
        </div>
      </div>
    );
  }

  // ---------- メインレンダリング ----------
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">

        {/* ====== 左: カレンダー ====== */}
        <div className="w-full lg:w-3/5">
          <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">

            {/* カレンダーヘッダー */}
            <div className="bg-indigo-700 text-white px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => { setCurrentDate(new Date(year, month - 2, 1)); setSelectedDate(null); }} className="p-1.5 rounded-lg hover:bg-indigo-600 transition font-bold text-lg">‹</button>
                <h2 className="text-xl font-bold">{format(currentDate, 'yyyy年M月', { locale: ja })}</h2>
                <button onClick={() => { setCurrentDate(new Date(year, month, 1)); setSelectedDate(null); }} className="p-1.5 rounded-lg hover:bg-indigo-600 transition font-bold text-lg">›</button>
              </div>

              {/* 月全体サマリーリンク */}
              <div className="flex justify-center">
                <Link
                  href={`/shifts/monthly-summary?year=${year}&month=${month}`}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-full text-xs font-semibold transition"
                >
                  📋 {month}月の確定シフト一覧を見る
                </Link>
              </div>
            </div>

            {/* ローディング・エラー */}
            {isLoading && (
              <div className="py-8 text-center text-indigo-600 font-medium text-sm">読み込み中...</div>
            )}
            {error && (
              <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">{error}</div>
            )}

            {/* カレンダーグリッド */}
            {!isLoading && (
              <div className="p-2">
                {/* 曜日ヘッダー */}
                <div className="grid grid-cols-7 mb-1">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                    <div key={d} className={`text-center text-xs font-bold py-2 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* 日付グリッド */}
                <div className="grid grid-cols-7 gap-0.5">
                  {/* 空マス */}
                  {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-16 rounded-lg bg-gray-50" />
                  ))}

                  {/* 日付セル */}
                  {daysInMonth.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDate === dateStr;
                    const isPast = day.getTime() < new Date().setHours(0, 0, 0, 0);
                    const dow = day.getDay();
                    const shifts = shiftsByDate[dateStr] ?? [];
                    const hasConfirmed = shifts.some(s => s.shift_type === 'confirmed');
                    const hasRequest = shifts.some(s => s.shift_type === 'request');

                    return (
                      <button
                        key={dateStr}
                        onClick={() => handleDayClick(day)}
                        className={`
                          h-16 rounded-xl p-1.5 text-left flex flex-col transition-all duration-150 border-2
                          ${isSelected
                            ? 'border-indigo-500 bg-indigo-50 shadow-md'
                            : isToday
                              ? 'border-red-400 bg-red-50'
                              : 'border-transparent hover:border-gray-300 hover:bg-gray-50'
                          }
                          ${isPast ? 'opacity-60' : ''}
                        `}
                      >
                        <span className={`text-sm font-bold leading-none ${
                          dow === 0 ? 'text-red-500'
                          : dow === 6 ? 'text-blue-500'
                          : isToday ? 'text-red-600'
                          : 'text-gray-800'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        {getShiftBadge(dateStr)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 凡例 */}
            <div className="px-4 pb-4 flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-emerald-200" />確定済み
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-amber-200" />希望提出済み
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded border-2 border-red-400" />今日
              </span>
            </div>
          </div>
        </div>

        {/* ====== 右: サイドパネル ====== */}
        <div className="w-full lg:w-2/5">
          <div className="bg-white shadow-xl rounded-2xl border border-gray-200 p-6 sticky top-6">

            {selectedDate ? (
              panelMode === 'detail' ? renderDetailPanel() : renderFormPanel()
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-gray-400 text-sm font-medium">
                  カレンダーから日付を選んでください
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  確定シフト・希望シフトの確認や<br />希望の提出ができます
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// frontend/app/shop/[shopId]/auto-adjust/page.tsx
"use client";
 
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";
import { useUser } from "../../../context/UserContext";
import Link from "next/link";
 
// -------------------- 型定義 --------------------
interface StaffUser {
  user_id: number;
  user_name: string;
  role: string;
}
 
interface RejectionHistory {
  user_id: number;
  user_name: string;
  total_requests: number;
  total_accepted: number;
  total_rejected: number;
  rejection_rate: number; // 0.0 ~ 1.0
  reset_mode: "manual" | "monthly";
  last_reset_year_month: string | null;
  updated_at: string | null;
}
 
type PrioritiesMap = Record<string, number>; // { "user_id": 1~5 }
type CapacitiesMap = Record<string, number>;
 
// 優先度ごとの色定義（ラベルなし）
const PRIORITY_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  5: { bg: "bg-yellow-400", text: "text-yellow-700", border: "border-yellow-400" },
  4: { bg: "bg-blue-400",   text: "text-blue-700",   border: "border-blue-400"   },
  3: { bg: "bg-green-400",  text: "text-green-700",  border: "border-green-400"  },
  2: { bg: "bg-orange-400", text: "text-orange-700", border: "border-orange-400" },
  1: { bg: "bg-gray-300",   text: "text-gray-500",   border: "border-gray-300"   },
};
 
// -------------------- コンポーネント --------------------
export default function AutoAdjustSettingsPage() {
  const params = useParams();
  const shopId = params.shopId as string;
  const { user } = useUser();
 
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [priorities, setPriorities] = useState<PrioritiesMap>({});
  const [capacities, setCapacities] = useState<CapacitiesMap>({});
  const [options, setOptions] = useState<Record<string, any>>({});
  const [histories, setHistories] = useState<RejectionHistory[]>([]);
 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
 
  const isAdmin = user?.role === "admin";
 
  // -------------------- データ取得 --------------------
  const fetchData = useCallback(async () => {
    if (!shopId || !isAdmin) return;
    setLoading(true);
    try {
      const [usersRes, cfgRes, histRes] = await Promise.all([
        api.get(`/shops/${shopId}/users`),
        api.get(`/shop/${shopId}/auto_adjust/config`),
        api.get(`/shop/${shopId}/rejection_history`),
      ]);
 
      const users: StaffUser[] = usersRes.data.users;
      setStaffList(users);
 
      const cfg = cfgRes.data.config;
      setCapacities(cfg.capacities || {});
      setOptions(cfg.options || {});
 
      // 未設定スタッフにはデフォルト3
      const basePriorities: PrioritiesMap = { ...(cfg.priorities || {}) };
      users.forEach((u) => {
        if (basePriorities[String(u.user_id)] === undefined) {
          basePriorities[String(u.user_id)] = 3;
        }
      });
      setPriorities(basePriorities);
 
      setHistories(histRes.data.histories || []);
    } catch {
      setMessage("データの取得に失敗しました");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [shopId, isAdmin]);
 
  useEffect(() => {
    fetchData();
  }, [fetchData]);
 
  // -------------------- ハンドラ --------------------
  const handlePriorityChange = (userId: number, value: number) => {
    setPriorities((prev) => ({ ...prev, [String(userId)]: value }));
  };
 
  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.post(`/shop/${shopId}/auto_adjust/config`, {
        priorities,
        capacities,
        options,
      });
      setMessage("設定を保存しました");
      setMessageType("success");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "保存に失敗しました");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };
 
  const handleResetHistory = async () => {
    if (!confirm("全スタッフの棄却履歴をリセットしますか？\nこの操作は元に戻せません。")) return;
    setResetting(true);
    try {
      await api.post(`/shop/${shopId}/rejection_history/reset`, { reset_type: "all" });
      setMessage("棄却履歴をリセットしました");
      setMessageType("success");
      await fetchData();
    } catch (err: any) {
      setMessage(err.response?.data?.error || "リセットに失敗しました");
      setMessageType("error");
    } finally {
      setResetting(false);
    }
  };
 
  // -------------------- ガード --------------------
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-lg border border-red-200 text-center">
          <p className="text-red-600 font-medium">管理者のみアクセスできます</p>
        </div>
      </div>
    );
  }
 
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    );
  }
 
  // 棄却履歴をuser_idでマップ化
  const historyMap: Record<number, RejectionHistory> = {};
  histories.forEach((h) => { historyMap[h.user_id] = h; });
 
  // -------------------- UI --------------------
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
 
        {/* パンくず */}
        <Link href={`/shop/${shopId}`} className="text-indigo-500 hover:text-indigo-700 text-sm font-medium">
          ← 店舗詳細に戻る
        </Link>
 
        {/* フラッシュ */}
        {message && (
          <div className={`p-3 rounded-lg border text-sm font-medium text-center ${
            messageType === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {message}
          </div>
        )}
 
        {/* ===== 優先度設定カード ===== */}
        <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
 
          {/* ヘッダー */}
          <div className="px-8 pt-7 pb-5 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">スタッフ優先度設定</h1>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              優先度が高いスタッフほどシフト希望が採用されやすくなります。<br />
              優先度が同じ場合は、累積の棄却率が高いスタッフを優先して調整します。
            </p>
          </div>
 
          {/* 優先度スケール説明バー */}
          <div className="px-8 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium shrink-0">低</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((lv) => (
                <div
                  key={lv}
                  className={`w-7 h-7 rounded-full ${PRIORITY_COLORS[lv].bg} flex items-center justify-center text-white font-bold text-xs shadow-sm`}
                >
                  {lv}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-400 font-medium shrink-0">高</span>
            <span className="ml-auto text-xs text-gray-300">クリックで変更</span>
          </div>
 
          {/* スタッフ行 */}
          <div className="divide-y divide-gray-100">
            {staffList.length === 0 ? (
              <p className="py-10 text-center text-gray-400 text-sm">スタッフが登録されていません</p>
            ) : (
              staffList.map((staff) => {
                const prio = priorities[String(staff.user_id)] ?? 3;
                const hist = historyMap[staff.user_id];
                const rejRate = hist ? Math.round(hist.rejection_rate * 100) : null;
                const colors = PRIORITY_COLORS[prio];
 
                return (
                  <div key={staff.user_id} className="flex items-center gap-4 px-8 py-4 hover:bg-gray-50/60 transition">
 
                    {/* アバター（優先度カラー） */}
                    <div className={`w-9 h-9 rounded-full ${colors.bg} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>
                      {staff.user_name.charAt(0)}
                    </div>
 
                    {/* 名前 + 棄却率サブテキスト */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{staff.user_name}</p>
                      {rejRate !== null ? (
                        <p className="text-xs text-gray-400 mt-0.5">
                          棄却率{" "}
                          <span className={`font-semibold ${
                            rejRate >= 60 ? "text-red-500" :
                            rejRate >= 30 ? "text-yellow-600" :
                            "text-green-600"
                          }`}>
                            {rejRate}%
                          </span>
                          <span className="text-gray-300 ml-1">
                            ({hist!.total_accepted}/{hist!.total_requests}件採用)
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300 mt-0.5">履歴なし</p>
                      )}
                    </div>
 
                    {/* 現在の優先度ラベル */}
                    <span className={`text-xs font-bold ${colors.text} shrink-0 w-14 text-right`}>
                      優先度 {prio}
                    </span>
 
                    {/* 優先度ボタン群 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((lv) => {
                        const lc = PRIORITY_COLORS[lv];
                        const isActive = prio === lv;
                        return (
                          <button
                            key={lv}
                            onClick={() => handlePriorityChange(staff.user_id, lv)}
                            className={`w-8 h-8 rounded-full text-xs font-bold border-2 transition-all duration-100 ${
                              isActive
                                ? `${lc.bg} ${lc.border} text-white shadow-md scale-110`
                                : `bg-white border-gray-200 text-gray-400 hover:${lc.border} hover:text-gray-600`
                            }`}
                          >
                            {lv}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
 
          {/* 保存ボタン */}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:bg-gray-300 transition shadow-sm"
            >
              {saving ? "保存中..." : "優先度設定を保存する"}
            </button>
          </div>
        </div>
 
        {/* ===== 棄却履歴カード ===== */}
        <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
 
          {/* ヘッダー */}
          <div className="px-8 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">累積棄却率</h2>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                優先度が同じスタッフ間では、棄却率が高い人が次回優先されます。<br />
                棄却が偏らないように自動で調整されます。
              </p>
            </div>
            <button
              onClick={handleResetHistory}
              disabled={resetting}
              className="shrink-0 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition disabled:opacity-40 whitespace-nowrap"
            >
              {resetting ? "リセット中..." : "履歴をリセット"}
            </button>
          </div>
 
          {histories.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm text-gray-400">まだ履歴がありません</p>
              <p className="text-xs text-gray-300 mt-1">シフトを確定すると集計が開始されます</p>
            </div>
          ) : (
            <div>
              {/* テーブルヘッダー */}
              <div className="grid grid-cols-12 px-8 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <span className="col-span-3">スタッフ</span>
                <span className="col-span-5">棄却率</span>
                <span className="col-span-2 text-right">採用</span>
                <span className="col-span-2 text-right">提出</span>
              </div>
 
              {/* 棄却率が高い順でソート */}
              <div className="divide-y divide-gray-100">
                {[...histories]
                  .sort((a, b) => b.rejection_rate - a.rejection_rate)
                  .map((h) => {
                    const pct = Math.round(h.rejection_rate * 100);
                    const barColor =
                      pct >= 60 ? "bg-red-400" :
                      pct >= 30 ? "bg-yellow-400" :
                      "bg-green-400";
                    const textColor =
                      pct >= 60 ? "text-red-500" :
                      pct >= 30 ? "text-yellow-600" :
                      "text-green-600";
 
                    return (
                      <div key={h.user_id} className="grid grid-cols-12 items-center px-8 py-3 gap-2 hover:bg-gray-50/50">
                        {/* スタッフ名 */}
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs shrink-0">
                            {h.user_name?.charAt(0) ?? "?"}
                          </div>
                          <span className="text-sm text-gray-700 truncate">{h.user_name}</span>
                        </div>
 
                        {/* 棄却率バー */}
                        <div className="col-span-5 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${barColor} transition-all duration-700`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-8 text-right shrink-0 ${textColor}`}>
                            {pct}%
                          </span>
                        </div>
 
                        {/* 採用・提出数 */}
                        <span className="col-span-2 text-right text-sm text-gray-600 font-medium">{h.total_accepted}</span>
                        <span className="col-span-2 text-right text-sm text-gray-400">{h.total_requests}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
 
        {/* カレンダーへ誘導 */}
        <div className="text-center pb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 bg-green-600 text-white py-2.5 px-6 rounded-xl text-sm font-semibold hover:bg-green-700 transition shadow-md"
          >
            カレンダーへ戻って自動調整を実行 →
          </Link>
        </div>
 
      </div>
    </div>
  );
}
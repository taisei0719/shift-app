// frontend/app/shop/[shopId]/auto-adjust/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "../../../../lib/api";
import { useUser } from "../../../context/UserContext";
import Link from "next/link";

interface StaffUser {
  user_id: number;
  user_name: string;
  role: string;
}

// 優先度マップ { "user_id": priority_int }
type PrioritiesMap = Record<string, number>;
type CapacitiesMap = Record<string, number>;

// 優先度ラベル定義
const PRIORITY_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  5: { label: "エース", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300" },
  4: { label: "ベテラン", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  3: { label: "中堅", color: "text-green-700", bg: "bg-green-100 border-green-300" },
  2: { label: "準戦力", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
  1: { label: "新人", color: "text-gray-600", bg: "bg-gray-100 border-gray-300" },
};

export default function AutoAdjustSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const shopId = params.shopId as string;
  const { user } = useUser();

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [priorities, setPriorities] = useState<PrioritiesMap>({});
  const [capacities, setCapacities] = useState<CapacitiesMap>({});
  const [options, setOptions] = useState<Record<string, any>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  // 棄却率シミュレーション結果
  const [simulation, setSimulation] = useState<{
    users: Record<string, { accepted: number; total: number; rate: number }>;
    overall: { accepted: number; total: number; rate: number };
  } | null>(null);

  const isAdmin = user?.role === "admin";

  // データ取得
  const fetchData = useCallback(async () => {
    if (!shopId || !isAdmin) return;
    setLoading(true);
    try {
      const [usersRes, cfgRes] = await Promise.all([
        api.get(`/shops/${shopId}/users`),
        api.get(`/shop/${shopId}/auto_adjust/config`),
      ]);

      const users: StaffUser[] = usersRes.data.users;
      setStaffList(users);

      const cfg = cfgRes.data.config;
      setPriorities(cfg.priorities || {});
      setCapacities(cfg.capacities || {});
      setOptions(cfg.options || {});

      // 優先度が未設定のスタッフにデフォルト値3をセット
      setPriorities((prev) => {
        const next = { ...cfg.priorities };
        users.forEach((u) => {
          if (next[String(u.user_id)] === undefined) {
            next[String(u.user_id)] = 3;
          }
        });
        return next;
      });
    } catch (e) {
      setMessage("データの取得に失敗しました");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [shopId, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 優先度変更
  const handlePriorityChange = (userId: number, value: number) => {
    setPriorities((prev) => ({ ...prev, [String(userId)]: value }));
  };

  // 設定保存
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

  // ---- UI ----

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
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4 space-y-6">

        {/* ===== ヘッダー ===== */}
        <div className="flex items-center gap-3 mb-2">
          <Link
            href={`/shop/${shopId}`}
            className="text-indigo-500 hover:text-indigo-700 text-sm font-medium"
          >
            ← 店舗詳細に戻る
          </Link>
        </div>

        <div className="bg-white shadow-xl rounded-lg border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 border-b pb-3 mb-2">
            ⚙️ シフト自動調整 詳細設定
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            各スタッフの熟達度（優先度）を設定します。優先度が高いスタッフほどシフト希望が通りやすくなります。
          </p>

          {/* フラッシュ */}
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg border text-sm font-medium text-center ${
                messageType === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          {/* ===== 優先度凡例 ===== */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              優先度レベル
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRIORITY_LABELS)
                .reverse()
                .map(([level, { label, color, bg }]) => (
                  <span
                    key={level}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${color} ${bg}`}
                  >
                    Lv.{level} {label}
                  </span>
                ))}
            </div>
          </div>

          {/* ===== スタッフ優先度設定 ===== */}
          <div className="space-y-3 mb-8">
            <h2 className="text-base font-semibold text-gray-800">
              スタッフ別 熟達度（優先度）
            </h2>
            {staffList.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center border border-dashed rounded-lg">
                スタッフが登録されていません
              </p>
            ) : (
              staffList.map((staff) => {
                const prio = priorities[String(staff.user_id)] ?? 3;
                const prioInfo = PRIORITY_LABELS[prio];
                return (
                  <div
                    key={staff.user_id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {/* アバター */}
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                      {staff.user_name.charAt(0)}
                    </div>

                    {/* 名前・ロール */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {staff.user_name}
                      </p>
                      <p className="text-xs text-gray-400">{staff.role}</p>
                    </div>

                    {/* 優先度バッジ */}
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border shrink-0 ${prioInfo?.color ?? "text-gray-600"} ${prioInfo?.bg ?? "bg-gray-100"}`}
                    >
                      Lv.{prio} {prioInfo?.label ?? ""}
                    </span>

                    {/* スライダー */}
                    <div className="flex items-center gap-2 shrink-0">
                      {[1, 2, 3, 4, 5].map((lv) => (
                        <button
                          key={lv}
                          onClick={() =>
                            handlePriorityChange(staff.user_id, lv)
                          }
                          className={`w-8 h-8 rounded-full text-xs font-bold border-2 transition duration-100 ${
                            prio === lv
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-gray-300 text-gray-500 hover:border-indigo-400"
                          }`}
                        >
                          {lv}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ===== オプション設定 ===== */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-base font-semibold text-blue-800 mb-3">
              📋 調整オプション（簡易設定）
            </h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!options.respect_all_requests}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      respect_all_requests: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-sm text-blue-700">
                  希望者全員を優先してシフトに入れる（定員超過時は優先度で判定）
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!options.balance_hours}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      balance_hours: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-sm text-blue-700">
                  月間労働時間を均等に配分する（特定スタッフへの偏り防止）
                </span>
              </label>

              <div className="flex items-center gap-3">
                <label className="text-sm text-blue-700 shrink-0">
                  1日の最大スタッフ数:
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={options.max_staff_per_day ?? ""}
                  placeholder="制限なし"
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      max_staff_per_day: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    }))
                  }
                  className="w-24 border border-blue-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-xs text-blue-500">人（空白で制限なし）</span>
              </div>
            </div>
          </div>

          {/* ===== 保存ボタン ===== */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg shadow-sm text-base font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition duration-150"
          >
            {saving ? "保存中..." : "設定を保存する"}
          </button>
        </div>

        {/* ===== シフト確認画面へのリンク ===== */}
        <div className="bg-white shadow-xl rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">
            設定が完了したら、シフト確認・確定画面で自動調整を実行できます。
          </p>
          <Link
            href="/admin"
            className="inline-block bg-green-600 text-white py-2 px-6 rounded-lg text-sm font-semibold hover:bg-green-700 transition duration-150"
          >
            カレンダーへ戻って自動調整を実行 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// frontend/app/shop/[shopId]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, getErrorMessage } from "../../../lib/api";
import { useUser } from "../../context/UserContext";
import Link from "next/link";

interface ShopData {
  name: string;
  location: string;
  shop_code: string;
}

interface StaffUser {
  user_id: number;
  position: string | null;
}

// 時間帯別定員の型 { "9": 3, "10": 5, ... }
type HourCapacityMap = Record<string, number>;
// ポジション別・時間帯別定員の型 { "kitchen": { "9": 3, ... }, "unspecified": { ... } }
type CapacitiesMap = Record<string, HourCapacityMap>;

// positionが設定されていないスタッフの定員を表すバケットキー（backendの予約語と一致させる）
const UNSPECIFIED_POSITION = "unspecified";
const UNSPECIFIED_POSITION_LABEL = "未設定";

// backendから取得したcapacitiesを新形式（ポジション別）に正規化する。
// 旧形式のフラットな { "<hour>": int } はUNSPECIFIED_POSITIONバケットとして扱う（backendの正規化ロジックと同じ）。
function normalizeCapacities(raw: Record<string, unknown> | null | undefined): CapacitiesMap {
  if (!raw || Object.keys(raw).length === 0) return {};
  const isPositionMap = Object.values(raw).every(
    (v) => typeof v === "object" && v !== null && !Array.isArray(v)
  );
  if (isPositionMap) {
    return raw as CapacitiesMap;
  }
  return { [UNSPECIFIED_POSITION]: raw as HourCapacityMap };
}

export default function ShopDetail() {
  const router = useRouter();
  const params = useParams();
  const shopId = params.shopId as string;

  const [shop, setShop] = useState<ShopData | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const { user } = useUser();

  // 営業時間設定
  const [openHour, setOpenHour] = useState(9);
  const [closeHour, setCloseHour] = useState(22);

  // ポジション別・時間帯別定員
  const [capacities, setCapacities] = useState<CapacitiesMap>({});
  // 定員設定タブで選択中のポジション（未設定 = UNSPECIFIED_POSITION）
  const [selectedPosition, setSelectedPosition] = useState<string>(UNSPECIFIED_POSITION);
  // スタッフに設定されている既存ポジションの一覧（タブ表示用）
  const [staffPositions, setStaffPositions] = useState<string[]>([]);

  // 設定ローディング
  const [configLoading, setConfigLoading] = useState(false);
  // auto_adjust設定の取得が完了したか（失敗・未完了時に初期状態のまま保存してしまうのを防ぐ）
  const [configLoaded, setConfigLoaded] = useState(false);

  const isAdmin = user?.role === "admin";

  // 店舗情報取得
  useEffect(() => {
    if (!shopId || shopId === "unknown") {
      setShop(null);
      return;
    }
    api
      .get(`/shop/${shopId}`)
      .then((res) => setShop(res.data))
      .catch(() => setShop(null));
  }, [shopId]);

  // 自動調整設定の取得（スタッフ一覧の取得失敗が設定データを巻き込んで破棄しないよう、別リクエストとして扱う）
  useEffect(() => {
    if (!shopId || shopId === "unknown" || !isAdmin) return;
    setConfigLoaded(false);
    api
      .get(`/shop/${shopId}/auto_adjust/config`)
      .then((res) => {
        const cfg = res.data.config;
        const caps = normalizeCapacities(cfg.capacities);
        setCapacities(caps);

        // 営業時間は保存済みのoptionsを優先し、なければ全ポジションのcapacitiesから推定する
        // （定員>0の最小・最大時間。capacitiesが未設定/全て0の場合は保存済み営業時間を優先すべきため）
        const savedOpenHour = cfg.options?.open_hour;
        const savedCloseHour = cfg.options?.close_hour;
        if (typeof savedOpenHour === "number" && typeof savedCloseHour === "number") {
          setOpenHour(savedOpenHour);
          setCloseHour(savedCloseHour);
        } else {
          const hours = Object.values(caps).flatMap((posCaps) =>
            Object.keys(posCaps)
              .map(Number)
              .filter((h) => posCaps[String(h)] > 0)
          );
          if (hours.length > 0) {
            setOpenHour(Math.min(...hours));
            setCloseHour(Math.max(...hours) + 1);
          }
        }
        setConfigLoaded(true);
      })
      .catch(() => {});
  }, [shopId, isAdmin]);

  // スタッフに設定済みのポジション一覧の取得（タブ表示用）
  useEffect(() => {
    if (!shopId || shopId === "unknown" || !isAdmin) return;
    api
      .get(`/shops/${shopId}/users`)
      .then((res) => {
        const users: StaffUser[] = res.data.users || [];
        const positions = Array.from(
          new Set(users.map((u) => u.position).filter((p): p is string => !!p))
        );
        setStaffPositions(positions);
      })
      .catch(() => {});
  }, [shopId, isAdmin]);

  // 営業時間が変わったら全ポジションの定員をリセット（範囲外の時間帯を削除）
  useEffect(() => {
    setCapacities((prev) => {
      const next: CapacitiesMap = {};
      for (const pos of Object.keys(prev)) {
        const prevPosCaps = prev[pos] || {};
        const nextPosCaps: HourCapacityMap = {};
        for (let h = openHour; h < closeHour; h++) {
          nextPosCaps[String(h)] = prevPosCaps[String(h)] ?? 0;
        }
        next[pos] = nextPosCaps;
      }
      return next;
    });
  }, [openHour, closeHour]);

  // 定員変更ハンドラ（選択中のポジションの定員を更新）
  const handleCapacityChange = (hour: number, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setCapacities((prev) => ({
      ...prev,
      [selectedPosition]: {
        ...(prev[selectedPosition] || {}),
        [String(hour)]: num,
      },
    }));
  };

  // タブ（ポジション）一覧: 未設定 + スタッフに設定済みのポジション
  const positionTabs = [UNSPECIFIED_POSITION, ...staffPositions];
  const selectedPositionLabel =
    selectedPosition === UNSPECIFIED_POSITION ? UNSPECIFIED_POSITION_LABEL : selectedPosition;
  const currentCapacities: HourCapacityMap = capacities[selectedPosition] || {};

  // 店舗情報更新
  const handleShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    if (!isAdmin) {
      setMessage("権限がないため更新できません");
      setMessageType("error");
      return;
    }
    try {
      await api.post(`/shop/${shopId}`, {
        name: shop.name,
        location: shop.location,
      });
      setMessage("店舗情報を更新しました");
      setMessageType("success");
    } catch (err) {
      setMessage(getErrorMessage(err, "更新に失敗しました"));
      setMessageType("error");
    }
  };

  // 営業時間・定員保存
  const handleConfigSave = async () => {
    setConfigLoading(true);
    try {
      // 既存のprioritiesを取得してマージ
      const cfgRes = await api.get(`/shop/${shopId}/auto_adjust/config`);
      const priorities = cfgRes.data.config.priorities || {};

      await api.post(`/shop/${shopId}/auto_adjust/config`, {
        priorities,
        capacities,
        options: { open_hour: openHour, close_hour: closeHour },
      });
      setMessage("営業時間・定員設定を保存しました");
      setMessageType("success");
    } catch (err) {
      setMessage(getErrorMessage(err, "設定の保存に失敗しました"));
      setMessageType("error");
    } finally {
      setConfigLoading(false);
    }
  };

  // ---- UI ----

  if (!shop) {
    const registerPath = isAdmin ? "/shop_register" : "/staff_shop_register";
    const registerLabel = isAdmin
      ? "店舗登録ページへ移動"
      : "店舗参加（コード入力）へ移動";

    return (
      <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
        <div className="w-full max-w-lg p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200 text-center">
          <h1 className="text-2xl font-bold text-gray-900">店舗情報</h1>
          <p className="text-gray-600">店舗が登録されていません</p>
          <button
            onClick={() => router.push(registerPath)}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 transition duration-150"
          >
            {registerLabel}
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-gray-600 transition duration-150"
          >
            カレンダーに戻る
          </button>
        </div>
      </div>
    );
  }

  const hourRange = Array.from(
    { length: closeHour - openHour },
    (_, i) => openHour + i
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4 space-y-6">

        {/* ===== フラッシュメッセージ ===== */}
        {message && (
          <div
            className={`p-3 rounded-lg border text-sm font-medium text-center ${
              messageType === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {/* ===== 店舗基本情報カード ===== */}
        <div className="bg-white shadow-xl rounded-lg border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-3">
            店舗情報確認・編集
          </h1>

          {!isAdmin && (
            <p className="text-sm text-center text-orange-600 border border-orange-200 bg-orange-50 p-2 rounded-md mb-4">
              スタッフアカウントのため、店舗情報の編集はできません。
            </p>
          )}

          <form onSubmit={handleShopSubmit} className="space-y-4">
            <label className="block">
              <span className="text-gray-700 font-medium">店舗名:</span>
              <input
                type="text"
                value={shop.name}
                onChange={(e) => setShop({ ...shop, name: e.target.value })}
                required
                readOnly={!isAdmin}
                className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm ${
                  !isAdmin
                    ? "bg-gray-100 cursor-not-allowed"
                    : "focus:ring-indigo-500 focus:border-indigo-500"
                }`}
              />
            </label>

            <label className="block">
              <span className="text-gray-700 font-medium">所在地:</span>
              <input
                type="text"
                value={shop.location}
                onChange={(e) => setShop({ ...shop, location: e.target.value })}
                readOnly={!isAdmin}
                className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm ${
                  !isAdmin
                    ? "bg-gray-100 cursor-not-allowed"
                    : "focus:ring-indigo-500 focus:border-indigo-500"
                }`}
              />
            </label>

            <label className="block">
              <span className="text-gray-700 font-medium">店舗コード:</span>
              <input
                type="text"
                value={shop.shop_code}
                readOnly
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-default font-mono text-center tracking-widest"
              />
              <p className="text-xs text-gray-500 mt-1">
                スタッフの参加に必要なコードです。
              </p>
            </label>

            {isAdmin && (
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 transition duration-150"
              >
                店舗情報を更新
              </button>
            )}
          </form>
        </div>

        {/* ===== 営業時間・時間帯定員設定カード (管理者のみ) ===== */}
        {isAdmin && (
          <div className="bg-white shadow-xl rounded-lg border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              営業時間・時間帯別定員設定
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              シフト自動調整に使用される各時間帯の最大スタッフ数を設定します。
            </p>

            {/* 営業時間 */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開店時間
                </label>
                <select
                  value={openHour}
                  onChange={(e) => setOpenHour(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                    <option key={h} value={h} disabled={h >= closeHour}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-gray-400 font-bold mt-5">〜</span>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  閉店時間
                </label>
                <select
                  value={closeHour}
                  onChange={(e) => setCloseHour(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h} disabled={h <= openHour}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ポジション別タブ */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">ポジション</p>
              <div className="flex flex-wrap gap-2">
                {positionTabs.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      selectedPosition === pos
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {pos === UNSPECIFIED_POSITION ? UNSPECIFIED_POSITION_LABEL : pos}
                  </button>
                ))}
              </div>
              {staffPositions.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  スタッフにポジションを設定すると、ポジションごとに定員を分けて設定できます。
                  （<Link href={`/shop/${shopId}/users`} className="text-indigo-500 hover:text-indigo-700">従業員一覧</Link>で設定）
                </p>
              )}
            </div>

            {/* 時間帯別定員グリッド */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                {selectedPositionLabel} の時間帯別 必要スタッフ数
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {hourRange.map((h) => (
                  <div
                    key={h}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm font-mono text-gray-600 w-12 shrink-0">
                      {String(h).padStart(2, "0")}:00
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={currentCapacities[String(h)] ?? 0}
                      onChange={(e) =>
                        handleCapacityChange(h, e.target.value)
                      }
                      className="w-14 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="text-xs text-gray-400">人</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 保存ボタン */}
            <button
              onClick={handleConfigSave}
              disabled={configLoading || !configLoaded}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 transition duration-150"
            >
              {configLoading
                ? "保存中..."
                : !configLoaded
                ? "設定を読み込み中..."
                : "営業時間・定員を保存"}
            </button>
            {!configLoaded && !configLoading && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                設定の取得が完了するまで保存できません。読み込みに失敗した場合はページを再読み込みしてください。
              </p>
            )}

            {/* 自動調整設定ページへのリンク */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link
                href={`/shop/${shopId}/auto-adjust`}
                className="flex items-center justify-center gap-2 w-full py-2 px-4 border-2 border-indigo-500 text-indigo-600 rounded-md text-sm font-semibold hover:bg-indigo-50 transition duration-150"
              >
                シフト自動調整の詳細設定へ
                <span>→</span>
              </Link>
            </div>
          </div>
        )}

        {/* ===== ナビゲーションボタン ===== */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/admin")}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-gray-600 transition duration-150"
          >
            ← カレンダーに戻る
          </button>
          <Link
            href={`/shop/${shopId}/users`}
            className="flex-1 text-center bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 transition duration-150"
          >
            従業員一覧
          </Link>
        </div>
      </div>
    </div>
  );
}


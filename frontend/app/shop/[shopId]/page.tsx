// frontend/app/shop/[shopId]/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "../../../lib/api";
import { useUser } from "../../context/UserContext";

export default function ShopDetail() {
  const router = useRouter();
  const params = useParams();
  const shopId = params.shopId as string; // useParamsはstring | string[]を返すため型アサーション
  const [shop, setShop] = useState<{ name: string; location: string; shop_code: string } | null>(null);
  const [message, setMessage] = useState("");
  const { user } = useUser(); 

  useEffect(() => {
    if (!shopId || shopId === "unknown") {
      setShop(null);
      return;
    }

    api.get(`/shop/${shopId}`)
      .then(res => setShop(res.data))
      .catch(() => setShop(null));
  }, [shopId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    
    // 編集可能なのは管理者のみ
    if (user?.role !== 'admin') {
      setMessage("権限がないため更新できません");
      return;
    }

    try {
      await api.post(`/shop/${shopId}`, { name: shop.name, location: shop.location });
      setMessage("更新成功");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "更新に失敗しました");
    }
  };

  // メッセージの色をTailwindクラスで動的に設定
  const messageColorClass = message.includes("失敗") || message.includes("権限がない") ? "text-red-600" : "text-green-600";
  const isAdmin = user && user.role === 'admin';
  const isReadOnly = !isAdmin;

  // ----------------------------------------------------------------------
  // ★ 1. 店舗情報未登録時の表示 (shop === null の場合)
  // ----------------------------------------------------------------------
  if (!shop) {
    const register_path = isAdmin ? "/shop_register" : "/staff_shop_register";
    const register_label = isAdmin ? "店舗登録ページへ移動" : "店舗参加（コード入力）へ移動"; 

    return (
      <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
        <div className="w-full max-w-lg p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200 text-center">
          
          <h1 className="text-2xl font-bold text-gray-900">店舗情報</h1>
          <p className="text-gray-600">店舗が登録されていません</p>
          
          <div className="space-y-3 pt-4">
            {/* 登録・参加ボタン */}
            <button 
              onClick={() => router.push(register_path)}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
            >
              {register_label}
            </button>
            
            {/* カレンダーに戻るボタン */}
            <button 
              onClick={() => router.push("/admin")}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-150"
            >
              カレンダーに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // ★ 2. 店舗情報登録済みの場合の表示 (shop !== null の場合)
  // ----------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
      <div className="w-full max-w-lg p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200">
        
        <h1 className="text-2xl font-bold text-gray-900 text-center">店舗情報確認・編集</h1>
        
        {/* メッセージ表示エリア */}
        {message && <p className={`text-sm text-center ${messageColorClass} font-medium`}>{message}</p>}
        
        {isReadOnly && (
          <p className="text-sm text-center text-orange-600 border border-orange-200 bg-orange-50 p-2 rounded-md">
            スタッフアカウントのため、店舗情報の編集はできません。
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 店舗名 */}
          <label className="block">
            <span className="text-gray-700 font-medium">店舗名:</span>
            <input
              type="text"
              value={shop.name}
              onChange={(e) => setShop({ ...shop, name: e.target.value })}
              required
              readOnly={isReadOnly}
              className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 ${isReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-indigo-500 focus:border-indigo-500'}`}
            />
          </label>
          
          {/* 所在地 */}
          <label className="block">
            <span className="text-gray-700 font-medium">所在地:</span>
            <input
              type="text"
              value={shop.location}
              onChange={(e) => setShop({ ...shop, location: e.target.value })}
              readOnly={isReadOnly}
              className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 ${isReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-indigo-500 focus:border-indigo-500'}`}
            />
          </label>
          
          {/* 店舗コード (常に読み取り専用) */}
          <label className="block">
            <span className="text-gray-700 font-medium">店舗コード:</span>
            <input 
              type="text" 
              value={shop.shop_code} 
              readOnly 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-default font-mono text-center"
            />
            <p className="text-xs text-gray-500 mt-1">スタッフの参加に必要なコードです。</p>
          </label>
          
          {/* 更新ボタン (管理者のみ表示) */}
          {!isReadOnly && (
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
            >
              店舗情報を更新
            </button>
          )}
        </form>
        
        {/* カレンダーに戻るボタン */}
        <button 
          onClick={() => router.push("/admin")}
          className="w-full bg-gray-500 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-150 mt-4"
        >
          カレンダーに戻る
        </button>
        
      </div>
    </div>
  );
}


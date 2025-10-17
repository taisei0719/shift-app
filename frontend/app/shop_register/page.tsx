// frontend/app/shop_register/page.tsx
"use client";

import React, { useState } from "react";
import { api } from "../../lib/api";
import { useRouter } from "next/navigation"; 

export default function ShopRegister() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter(); 

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("店舗を登録中..."); // ローディングフィードバック

    try {
      const res = await api.post("/shop_register", { name, location });
      
      const newShopId = res.data.shop_id;
      if (newShopId) {
          setMessage("店舗登録成功！詳細ページに移動します...");
          // 正しい動的ルーティングのパス /shop/[shopId] にリダイレクト
          // 💡 リダイレクト前にユーザー情報の更新（shop_idのセット）が必要な場合は、
          //    ここで userContext の refreshUser() などを呼び出してください。
          router.push(`/shop/${newShopId}`); 
      } else {
          setMessage(`登録成功しましたが、店舗IDが見つかりません。店舗コード: ${res.data.shop_code}`);
      }

    } catch (err) {
      const error = err as any;
      setMessage(error.response?.data?.error || "登録に失敗しました");
    }
  };

  // メッセージの色をTailwindクラスで動的に設定
  const messageColorClass = message.includes("失敗") || message.includes("見つかりません")
    ? "text-red-600"
    : message.includes("登録中") 
    ? "text-blue-500" // 登録中は青色
    : "text-green-600"; // 成功時は緑色

  return (
    // ★ ページのコンテナ: 中央寄せ、最小画面高
    <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
      
      {/* ★ フォームのカードコンテナ */}
      <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200">
        
        <h1 className="text-2xl font-bold text-gray-900 text-center">新規店舗登録</h1>
        <p className="text-sm text-gray-600 text-center">オーナーとして店舗情報を登録します。</p>
        
        {/* メッセージ表示エリア */}
        {message && (
          <p className={`text-sm text-center ${messageColorClass} font-medium border p-3 rounded-md ${message.includes("失敗") ? 'border-red-200 bg-red-50' : message.includes("登録中") ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
            {message}
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 店舗名入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">店舗名:</span>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              placeholder="例: 渋谷本店"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            />
          </label>
          
          {/* 所在地入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">所在地 (任意):</span>
            <input 
              type="text" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              placeholder="例: 東京都渋谷区..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            />
          </label>
          
          {/* 登録ボタン */}
          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
            disabled={message.includes("登録中")} // 重複送信防止
          >
            店舗を登録
          </button>
        </form>
        
      </div>
    </div>
  );
}

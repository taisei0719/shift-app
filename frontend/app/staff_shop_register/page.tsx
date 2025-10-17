//app/staff_shop_register/page.tsx

"use client";

import React, { useState } from "react";
import { api } from "../../lib/api";
import { useUser } from "../context/UserContext";

export default function StaffShopRequest() {
  const [shopCode, setShopCode] = useState("");
  const [message, setMessage] = useState("");
  const { user, refreshUser } = useUser();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("リクエストを送信中..."); 

    try {
      const res = await api.post("/join_shop/request", { shop_code: shopCode });
      
      const successMessage = res.data.message || "参加リクエストを送信しました！";
      setMessage(successMessage);
      
      await refreshUser();
      
    } catch (err) {
      const error = err as any; 
      const errorMessage = error.response?.data?.error || "リクエスト送信に失敗しました";
      console.error(err); 
      setMessage(errorMessage);
    }
  };

  // メッセージの色をTailwindクラスで動的に設定
  const messageColorClass = message.includes("失敗") || message.includes("リクエスト送信に失敗")
    ? "text-red-600"
    : message.includes("送信中") 
    ? "text-blue-500" // 送信中は青色
    : "text-green-600"; // 成功時は緑色

  return (
    // ページのコンテナ: 中央寄せ、最大幅設定、最小画面高
    <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
      
      {/* フォームのカードコンテナ */}
      <div className="w-full max-w-sm p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200">
        
        {/* タイトル */}
        <h1 className="text-2xl font-bold text-gray-900 text-center">店舗への参加リクエスト</h1> 
        
        <p className="text-sm text-gray-600 text-center">オーナーの承認を得るために、店舗コードを入力してください。</p>
        
        {/* メッセージ表示エリア */}
        {message && (
          <p className={`text-sm text-center ${messageColorClass} font-medium`}>
            {message}
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <label className="block">
            <span className="text-gray-700 font-medium">店舗コード (6桁):</span>
            <input
              type="text"
              value={shopCode}
              onChange={(e) => setShopCode(e.target.value)}
              inputMode="numeric" 
              pattern="\d{6}" 
              maxLength={6}
              required
              // input のスタイル
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-center text-lg tracking-widest focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            />
          </label>
          
          {/* リクエストボタン */}
          <button 
            type="submit"
            // button のスタイル
            className="w-full bg-indigo-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
            disabled={message.includes("送信中")} // 送信中はボタンを無効化
          >
            リクエストを送信
          </button>
        </form>
        
      </div>
    </div>
  );
}
//frontend/app/register/page.tsx

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import Link from "next/link";


export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      // 登録処理が成功したら、自動的にログイン状態になることを想定し、トップページへ遷移
      await api.post("/register", { name, email, password, role });
      router.push("/");
    } catch (err) {
      const error = err as any;
      setError(error.response?.data?.error || "登録に失敗しました");
    }
  };

  return (
    // ★ ページのコンテナ: 中央寄せ、最小画面高
    <div className="min-h-screen flex flex-col items-center justify-center py-12 bg-gray-50 sm:px-6 lg:px-8">
      
      {/* ★ フォームのカードコンテナ */}
      <div className="w-full max-w-md p-8 space-y-8 bg-white shadow-xl rounded-lg border border-gray-200">
        
        <h1 className="text-3xl font-extrabold text-gray-900 text-center">ユーザー登録</h1>
        
        {/* エラーメッセージ表示エリア */}
        {error && (
          <p className="text-sm text-center text-red-600 font-medium border border-red-200 bg-red-50 p-3 rounded-md">
            {error}
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 名前入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">名前:</span>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            />
          </label>
          
          {/* メールアドレス入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">メールアドレス:</span>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            />
          </label>
          
          {/* パスワード入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">パスワード:</span>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            />
          </label>
          
          {/* 役割選択ドロップダウン */}
          <label className="block">
            <span className="text-gray-700 font-medium">役割:</span>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)} 
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="staff">スタッフ</option>
              <option value="admin">オーナー</option>
            </select>
          </label>
          
          {/* 登録ボタン */}
          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
          >
            新規ユーザー登録
          </button>
        </form>
        
        {/* ログインへのリンク */}
        <div className="text-sm text-center pt-2">
          <p className="text-gray-600">
            すでにアカウントをお持ちですか？ 
            <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500 ml-1">
              ログイン
            </Link>
          </p>
        </div>
        
      </div>
    </div>
  );
}
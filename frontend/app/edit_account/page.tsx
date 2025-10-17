// frontend/app/edit_account/page.tsx

"use client";

import { useState } from "react";
import { useUser } from "../context/UserContext";
import { api } from "../../lib/api";
import { useRouter } from "next/navigation";

export default function EditAccount() {
  const { user, refreshUser, setUser } = useUser();
  const router = useRouter();

  const [name, setName] = useState(user?.user_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/account/edit", { name, email, password });
      setMessage("アカウント情報を更新しました");
      await refreshUser();
    } catch {
      setMessage("アカウント情報の更新に失敗しました");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("本当にあなたのアカウントを削除しますか？\nこの操作は元に戻せません。")) {
      return;
    }

    try {
      setMessage("アカウントを削除中...");
      await api.post("/account/delete");
      
      setUser(null);
      alert("アカウントは正常に削除されました。");
      router.push("/");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "アカウントの削除に失敗しました");
    }
  };

  if (!user) return <p className="text-center mt-8">ユーザー情報を取得中...</p>;

  // メッセージの色をTailwindクラスで動的に設定
  const messageColorClass = message.includes("失敗") ? "text-red-600" : "text-green-600";

  return (
    // ★ ページのコンテナ: 中央寄せ、最大幅設定、最小画面高
    <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
      
      {/* ★ フォームのカードコンテナ */}
      <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200">
        
        <h1 className="text-2xl font-bold text-gray-900 text-center">アカウント情報の編集</h1>
        
        {/* メッセージ表示エリア */}
        {message && <p className={`text-sm text-center ${messageColorClass}`}>{message}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 名前入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">名前:</span>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </label>
          
          {/* メール入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">メール:</span>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </label>
          
          {/* パスワード入力フィールド */}
          <label className="block">
            <span className="text-gray-700 font-medium">新しいパスワード:</span>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="変更しない場合は空欄" 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </label>
          
          {/* 更新ボタン */}
          <button 
            type="submit" 
            className="w-full bg-indigo-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
          >
            更新
          </button>
        </form>
        
        {/* アカウント削除エリア */}
        <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">アカウント削除</h2>
          
          {/* 削除ボタン */}
          <button 
            onClick={handleDelete} 
            className="w-full bg-red-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150"
          >
            アカウントを削除
          </button>
          
          {/* 注意書き */}
          <p className="text-red-500 text-xs text-center">
            ※ 削除すると、全てのシフトデータも失われます。
          </p>
        </div>
        
      </div>
    </div>
  );
}



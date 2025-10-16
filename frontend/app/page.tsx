// frontend/app/page.tsx

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import { useUser } from "./context/UserContext";

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setUser } = useUser();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await api.post("/login", { identifier, password });
      // ログイン成功時、APIから返ってきたユーザー情報でコンテキストを即座に更新する
      if (res.data.user) {
        setUser(res.data.user); 
      }
      router.push(res.data.user.role === "staff" ? "/staff" : "/admin");
    } catch (err) {
      const error = err as any;
      setError(error.response?.data?.error || "ログインに失敗しました");
    }
  };

  return (
    // login-container を削除し、Tailwindで中央配置とカードデザインを適用
    // w-full max-w-md で幅を制限し、p-8でパディング、bg-whiteで背景色、shadow-xlで影
    <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl mx-auto my-16">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-700">
        ログイン
      </h1>
      {error && <p className="text-red-600 text-center mb-4">{error}</p>}
      
      <form onSubmit={handleSubmit} className="space-y-4"> {/* space-y-4でフォーム要素間にスペース */}
        <label className="block text-gray-700 font-medium">
          名前またはメールアドレス:
          {/* inputにTailwindクラスを適用 */}
          <input 
            type="text" 
            value={identifier} 
            onChange={(e) => setIdentifier(e.target.value)} 
            required 
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </label>

        <label className="block text-gray-700 font-medium">
          パスワード:
          {/* inputにTailwindクラスを適用 */}
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </label>
        
        {/* buttonにTailwindクラスを適用 */}
        <button 
          type="submit" 
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-md shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          ログイン
        </button>
      </form>
      
      {/* center-message を削除し、Tailwindで中央配置とリンクスタイルを適用 */}
      <div className="mt-6 text-center text-sm text-gray-600">
        まだアカウントをお持ちでない方は 
        <a href="/register" className="text-indigo-600 hover:text-indigo-800 hover:underline ml-1 font-medium">
          ユーザー登録
        </a>
      </div>
    </div>
  );
}
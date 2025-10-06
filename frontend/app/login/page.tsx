"use client";
import { useState } from "react";
import { api } from "../../lib/api";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
      const res = await api.post("/login", { identifier, password });
      setMessage(res.data.message);
      window.location.href = "/staff"; // ログイン成功でスタッフページへ
    } catch (err: any) {
      setMessage(err.response?.data?.error || "ログイン失敗");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">ログイン</h1>
      <input
        type="text"
        placeholder="ユーザー名 or メール"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        className="w-full p-2 border mb-2"
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border mb-2"
      />
      <button onClick={handleLogin} className="w-full bg-blue-500 text-white p-2">
        ログイン
      </button>
      {message && <p className="mt-2 text-red-500">{message}</p>}
    </div>
  );
}

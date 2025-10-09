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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/login", { identifier, password });
      // ログイン成功時、APIから返ってきたユーザー情報でコンテキストを即座に更新する
      if (res.data.user) {
        setUser(res.data.user); 
      }
      router.push(res.data.user.role === "staff" ? "/staff" : "/admin");
    } catch (err) {
      setError(err.response?.data?.error || "ログインに失敗しました");
    }
  };

  return (
    <div className="login-container">
      <h1>ログイン</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          名前またはメールアドレス:<br />
          <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </label>
        <br />
        <label>
          パスワード:<br />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <br />
        <button type="submit">ログイン</button>
      </form>
      <div className="center-message">
        まだアカウントをお持ちでない方は <a href="/register">ユーザー登録</a>
      </div>
    </div>
  );
}
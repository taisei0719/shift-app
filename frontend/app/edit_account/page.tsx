"use client";

import { useState } from "react";
import { useUser } from "../context/UserContext";
import { api } from "../../lib/api";

export default function EditAccount() {
  const { user, refreshUser } = useUser();
  const [name, setName] = useState(user?.user_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/account/edit", { name, email, password });
      setMessage("更新しました");
      await refreshUser();
    } catch {
      setMessage("更新に失敗しました");
    }
  };

  if (!user) return <p>ユーザー情報を取得中...</p>;

  return (
    <div>
      <h1>アカウント情報の編集</h1>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          名前:
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <br />
        <label>
          メール:
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <br />
        <label>
          新しいパスワード:
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <br />
        <button type="submit">更新</button>
      </form>
    </div>
  );
}



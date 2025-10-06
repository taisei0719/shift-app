"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api"; // axios のインスタンス

interface User {
  name: string;
  email?: string;
  role: "admin" | "staff";
}

export default function EditAccount({ user }: { user: User }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/account/edit", { name, email, password });
      setMessage("アカウント情報を更新しました");
      // 更新後、元のページに戻る
      setTimeout(() => {
        router.push(user.role === "staff" ? "/staff" : "/admin");
      }, 1500);
    } catch (err: any) {
      setMessage(err.response?.data?.error || "更新に失敗しました");
    }
  };

  return (
    <div className="edit-account-container">
      <h1>アカウント情報の編集</h1>

      {message && <p style={{ color: "green" }}>{message}</p>}

      <form onSubmit={handleSubmit}>
        <label>
          名前:<br />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <br />

        <label>
          メールアドレス:<br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <br />

        <label>
          新しいパスワード（変更しない場合は空欄）:<br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <br />

        <button type="submit">更新</button>
      </form>

      <div className="center-message">
        <button
          onClick={() => router.push(user.role === "staff" ? "/staff" : "/admin")}
          className="link-button"
        >
          戻る
        </button>
      </div>
    </div>
  );
}

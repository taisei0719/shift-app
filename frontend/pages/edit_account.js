// frontend/pages/edit_account.js
import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/axios";
import { useRouter } from "next/router";

export default function EditAccount({ user }) {
  const router = useRouter();
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/edit_account", { name, email, password });
      setMessage("更新成功");
      // 更新後、画面遷移したい場合
      setTimeout(() => {
        router.push(user.role === "staff" ? "/staff" : "/admin");
      }, 1000);
    } catch (err) {
      setMessage(err.response?.data?.error || "更新に失敗しました");
    }
  };

  return (
    <Layout user={user}>
      <div className="edit-account-container">
        <h1>アカウント情報の編集</h1>
        {message && <p style={{ color: "red" }}>{message}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            名前:<br />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <br />
          <label>
            メールアドレス:<br />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <br />
          <label>
            新しいパスワード（変更しない場合は空欄）:<br />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <br />
          <button type="submit">更新</button>
        </form>
        <div className="center-message">
          <button onClick={() => router.push(user.role === "staff" ? "/staff" : "/admin")}>
            戻る
          </button>
        </div>
      </div>
    </Layout>
  );
}

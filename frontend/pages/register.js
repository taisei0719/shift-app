// frontend/pages/register.js
import React, { useState } from "react";
import { useRouter } from "next/router";
import { api } from "../lib/axios";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/register", { name, email, password, role });
      router.push("/login");
    } catch (err) {
      setError(err.response?.data?.error || "登録に失敗しました");
    }
  };

  return (
    <div>
      <h1>ユーザー登録</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          名前:<input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <br />
        <label>
          メールアドレス:<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <br />
        <label>
          パスワード:<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <br />
        <label>
          役割:
          <select value={role} onChange={(e) => setRole(e.target.value)} required>
            <option value="staff">スタッフ</option>
            <option value="admin">オーナー</option>
          </select>
        </label>
        <br />
        <button type="submit">登録</button>
      </form>
      <div className="center-message">
        すでにアカウントをお持ちですか？ <a href="/login">ログイン</a>
      </div>
    </div>
  );
}

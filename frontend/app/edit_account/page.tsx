// frontend/app/edit_account/page.tsx

"use client";

import { useState } from "react";
import { useUser } from "../context/UserContext";
import { api } from "../../lib/api";
import { useRouter } from "next/navigation"; // ★ 追加: リダイレクトのために必要

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

  // アカウント削除ロジックの追加
  const handleDelete = async () => {
    // 誤操作防止のため、確認ダイアログを表示
    if (!window.confirm("本当にあなたのアカウントを削除しますか？\nこの操作は元に戻せません。")) {
      return;
    }

    try {
      setMessage("アカウントを削除中...");
      // サーバーの削除APIを叩く
      await api.post("/account/delete");
      
      // 成功したら、コンテキストをログアウト状態にし、トップページにリダイレクト
      setUser(null);
      alert("アカウントは正常に削除されました。");
      router.push("/"); // トップページに遷移
    } catch (err: any) {
      setMessage(err.response?.data?.error || "アカウントの削除に失敗しました");
    }
  };

  if (!user) return <p>ユーザー情報を取得中...</p>;

  return (
    <div>
      <h1>アカウント情報の編集</h1>
      {message && <p style={{color: message.includes("失敗") ? "red" : "green"}}>{message}</p>}
      <form onSubmit={handleSubmit}>
        {/* ... (フォームの入力フィールドは変更なし) ... */}
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
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="変更しない場合は空欄" />
        </label>
        <br />
        <button type="submit">更新</button>
      </form>
    
      <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
        <h2>アカウント削除</h2>
        <button 
          onClick={handleDelete} 
          style={{ backgroundColor: 'red', color: 'white', padding: '10px', border: 'none', cursor: 'pointer' }}
        >
          アカウントを削除
        </button>
        <p style={{ color: 'red', fontSize: '12px' }}>※ 削除すると、全てのシフトデータも失われます。</p>
      </div>
    </div>
  );
}



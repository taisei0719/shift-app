// frontend/app/shop_register/page.tsx
"use client";

import React, { useState } from "react";
import { api } from "../../lib/api";
// ★ 修正点1: useRouter をインポートする
import { useRouter } from "next/navigation"; 

export default function ShopRegister({ user }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  // ★ 修正点2: useRouter のインスタンスを作成
  const router = useRouter(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/shop_register", { name, location });
      // setMessage(`登録成功！ 店舗コード: ${res.data.shop_code}`);
      
      // ★ 修正点3: 登録成功後、店舗IDを使って正しいパスにリダイレクト
      const newShopId = res.data.shop_id;
      if (newShopId) {
          setMessage("店舗登録成功！詳細ページに移動します...");
          // 正しい動的ルーティングのパス /shop/[shopId] にリダイレクト
          router.push(`/shop/${newShopId}`); 
      } else {
          setMessage(`登録成功しましたが、店舗IDが見つかりません。店舗コード: ${res.data.shop_code}`);
      }

    } catch (err) {
      setMessage(err.response?.data?.error || "登録に失敗しました");
    }
  };

  return (
    <>

      <h1>店舗登録</h1>
      {message && <p style={{ color: message.includes("成功") ? "green" : "red" }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          店舗名:<br />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <br />
        <label>
          所在地:<br />
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <br />
        <button type="submit">登録</button>
      </form>
    </>
  );
}

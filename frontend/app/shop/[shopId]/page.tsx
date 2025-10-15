// frontend/app/shop/[shopId]/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "../../../lib/api";
import { useUser } from "../../context/UserContext";

export default function ShopDetail() {
  const router = useRouter();
  const params = useParams();
  const shopId = params.shopId;
  const [shop, setShop] = useState<{ name: string; location: string; shop_code: string } | null>(null);
  const [message, setMessage] = useState("");
  const { user } = useUser(); 

  useEffect(() => {
    if (!shopId || shopId === "unknown") {
      setShop(null); // 未登録
      return;
    }

    api.get(`/shop/${shopId}`)
      .then(res => setShop(res.data))
      .catch(() => setShop(null));
  }, [shopId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    try {
      await api.post(`/shop/${shopId}`, { name: shop.name, location: shop.location });
      setMessage("更新成功");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "更新に失敗しました");
    }
  };

  if (!shop) {
    // ★ 修正点3: 店舗が未登録の場合の表示を role で切り替える
    const is_admin = user && user.role === 'admin';
    
    // 管理者か、ユーザー情報自体がない場合は /shop_register へ
    const register_path = is_admin ? "/shop_register" : "/staff_shop_register";
    
    // ボタンのラベルも切り替える
    const register_label = is_admin ? "店舗登録ページへ移動" : "店舗参加（コード入力）へ移動"; 

    return (
      <div className="shop-detail-container">
        <h1>店舗情報</h1>
        <p>店舗が登録されていません</p>
        
        {/* スタッフなら /edit_account、管理者なら /shop_register に遷移 */}
        <button onClick={() => router.push(register_path)}>{register_label}</button>
        
        <button onClick={() => router.push("/admin")}>カレンダーに戻る</button>
      </div>
    );
  }

  return (
    <div className="shop-detail-container">
      <h1>店舗情報確認・編集</h1>
      {message && <p style={{ color: "green" }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          店舗名:<br />
          <input
            type="text"
            value={shop.name}
            onChange={(e) => setShop({ ...shop, name: e.target.value })}
            required
          />
        </label>
        <br />
        <label>
          所在地:<br />
          <input
            type="text"
            value={shop.location}
            onChange={(e) => setShop({ ...shop, location: e.target.value })}
          />
        </label>
        <br />
        <label>
          店舗コード:<br />
          <input type="text" value={shop.shop_code} readOnly />
        </label>
        <br />
        <button type="submit">更新</button>
      </form>
      <button onClick={() => router.push("/admin")}>カレンダーに戻る</button>
    </div>
  );
}


// frontend/pages/shop/[shopId].js
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { api } from "../../lib/axios";
import Layout from "../../components/Layout";

export default function ShopDetail({ user }) {
  const router = useRouter();
  const { shopId } = router.query;
  const [shop, setShop] = useState({ name: "", location: "", shop_code: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (shopId) {
      api.get(`/shop/${shopId}`).then(res => setShop(res.data));
    }
  }, [shopId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/shop/${shopId}`, { name: shop.name, location: shop.location });
      setMessage("更新成功");
    } catch (err) {
      setMessage(err.response?.data?.error || "更新に失敗しました");
    }
  };

  return (
    <Layout user={user}>
      <div className="shop-detail-container">
        <h1>店舗情報確認・編集</h1>
        {message && <p style={{ color: "green" }}>{message}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            店舗名:<br />
            <input type="text" value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} required />
          </label>
          <br />
          <label>
            所在地:<br />
            <input type="text" value={shop.location} onChange={(e) => setShop({ ...shop, location: e.target.value })} />
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
    </Layout>
  );
}
// frontend/pages/shop_register.js
import React, { useState } from "react";
import { api } from "../lib/axios";
import Layout from "../components/Layout";

export default function ShopRegister({ user }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/shop_register", { name, location });
      setMessage(`登録成功！ 店舗コード: ${res.data.shop_code}`);
    } catch (err) {
      setMessage(err.response?.data?.error || "登録に失敗しました");
    }
  };

  return (
    <Layout user={user}>
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
    </Layout>
  );
}

"use client";

import React, { useState } from "react";
import { api } from "../../lib/api";

export default function StaffShopRegister({ user }) {
  const [shopCode, setShopCode] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/join_shop", { shop_code: shopCode });
      setMessage(res.data.message);
    } catch (err) {
      setMessage(err.response?.data?.error || "登録に失敗しました");
    }
  };

  return (
    <>
      <h1>店舗IDで登録</h1>
      {message && <p className="flash">{message}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          店舗ID:<br />
          <input
            type="text"
            value={shopCode}
            onChange={(e) => setShopCode(e.target.value)}
            required
          />
        </label>
        <br />
        <button type="submit">登録</button>
      </form>
    </>
  );
}
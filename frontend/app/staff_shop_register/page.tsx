"use client";

import React, { useState } from "react";
import { api } from "../../lib/api";

// ★ コンポーネント名を StaffShopRequest に変更
// ★ props に onUpdate 関数を追加
export default function StaffShopRequest({ user, onUpdate }) {
  const [shopCode, setShopCode] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("リクエストを送信中..."); // UIフィードバック

    try {
      // ★ 修正: エンドポイントを /api/join_shop/request に変更
      const res = await api.post("/join_shop/request", { shop_code: shopCode });
      
      const successMessage = res.data.message || "参加リクエストを送信しました！";
      setMessage(successMessage);
      
      // ★ 必須修正: リクエスト成功後、親コンポーネネントのユーザー情報を更新
      // userオブジェクトを直接変更するのではなく、onUpdateを通じて親のステートを更新する。
      // ここでは、ユーザーの shop_request_code がDBで更新されたことを反映させるために、
      // 実際には /api/session を再取得するか、親で管理している user ステートを更新する必要がある。
      // 今回はバックエンドのレスポンスが不十分なため、onUpdateを通じて親でセッションを再取得する設計とする。
      if (onUpdate) {
        // onUpdate を実行して、親コンポーネントにユーザー情報の再取得を促す
        onUpdate(successMessage); 
      }

    } catch (err) {
      // エラーレスポンスの確認
      const errorMessage = err.response?.data?.error || "リクエスト送信に失敗しました";
      console.error(err); 
      setMessage(errorMessage);
    }
  };

  return (
    <>
      {/* タイトルをリクエスト用に変更 */}
      <h1>店舗への参加リクエスト</h1> 
      <p>オーナーの承認を得るために、店舗コードを入力してください。</p>
      
      {/* メッセージ表示 */}
      {message && <p className="flash">{message}</p>}
      
      <form onSubmit={handleSubmit}>
        <label>
          店舗コード (6桁):<br />
          <input
            type="text"
            value={shopCode}
            onChange={(e) => setShopCode(e.target.value)}
            // 入力タイプを 'tel' にして、スマホで数字キーボードが出やすいようにするとUX向上
            inputMode="numeric" 
            pattern="\d{6}" // 6桁の数字のみを許可
            maxLength={6}
            required
          />
        </label>
        <br />
        <button type="submit">リクエストを送信</button>
      </form>
    </>
  );
}
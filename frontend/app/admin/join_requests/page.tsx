"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api"; // あなたの axios インスタンスをインポート
import { useUser } from "@/app/context/UserContext";

// リクエストデータの型定義
interface JoinRequest {
  user_id: number;
  name: string;
  email: string;
}

export default function AdminJoinRequestsPage() {
  const { user } = useUser();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 参加リクエスト一覧を取得する関数
  const fetchRequests = useCallback(async () => {
    if (!user || user.role !== 'admin') return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await api.get("/join_requests");
      setRequests(res.data.requests);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "リクエストの取得に失敗しました。";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 初回ロード時と操作後にリクエストを取得
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // 承認または拒否処理を実行する関数
  const handleAction = async (targetUserId: number, action: 'approve' | 'reject') => {
    if (!confirm(`${action === 'approve' ? '承認' : '拒否'}しますか？`)) {
      return;
    }

    try {
      // ユーザーIDを指定してPOSTリクエストを送信
      const res = await api.post(`/join_requests/${targetUserId}`, { action });
      
      // メッセージを表示
      setMessage(res.data.message);
      
      // 処理が成功したら、リストを更新するために再取得
      fetchRequests();

    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "処理に失敗しました。";
      setError(errorMessage);
      setMessage(null);
    }
  };

  if (loading) {
    return <div>リクエストを読み込み中...</div>;
  }

  if (error) {
    return <div className="error-message">エラー: {error}</div>;
  }
  
  if (user?.role !== 'admin') {
    return <div className="error-message">このページにアクセスする権限がありません。</div>;
  }

  return (
    <div className="admin-request-management">
      <h1>スタッフ参加リクエスト一覧</h1>
      
      {/* ユーザー操作後のフラッシュメッセージ */}
      {message && <p className="flash success">{message}</p>}
      
      {requests.length === 0 ? (
        <p>現在、新しい参加リクエストはありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>メールアドレス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.user_id}>
                <td>{req.name}</td>
                <td>{req.email}</td>
                <td>
                  <button 
                    onClick={() => handleAction(req.user_id, 'approve')}
                    className="btn-approve"
                  >
                    承認
                  </button>
                  <button 
                    onClick={() => handleAction(req.user_id, 'reject')}
                    className="btn-reject"
                    style={{ marginLeft: '10px' }}
                  >
                    拒否
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
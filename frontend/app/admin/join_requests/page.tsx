// app/admin/join_requests/page.tsx

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
        // ユーザー情報がない、またはadminでない場合は処理しない
        if (!user || user.role !== 'admin') {
            setLoading(false);
            return;
        }

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
            // 処理中はメッセージを表示してボタンを無効化
            setMessage(action === 'approve' ? "承認処理中..." : "拒否処理中...");
            setError(null);

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

    // ----------------------------------------------------------------------
    // ★ 状態ごとの表示
    // ----------------------------------------------------------------------
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-600">リクエストを読み込み中...</p>
            </div>
        );
    }
    
    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="p-8 bg-white shadow-lg rounded-lg border border-red-300 text-center">
                    <p className="text-red-500 font-medium">このページにアクセスする権限がありません。</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="p-8 bg-white shadow-lg rounded-lg border border-red-300">
                    <h2 className="text-xl font-bold text-red-600 mb-4">エラー</h2>
                    <p className="text-red-500">{error}</p>
                </div>
            </div>
        );
    }

    // メッセージの色をTailwindクラスで動的に設定
    const messageColorClass = message && (message.includes("成功") || message.includes("完了"))
        ? "text-green-600 border-green-200 bg-green-50"
        : message && message.includes("処理中") 
        ? "text-blue-500 border-blue-200 bg-blue-50"
        : "";

    // ----------------------------------------------------------------------
    // ★ メインコンテンツ
    // ----------------------------------------------------------------------
    return (
        <div className="min-h-screen flex justify-center py-10 bg-gray-50">
            <div className="w-full max-w-4xl p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200">
                
                <h1 className="text-3xl font-extrabold text-gray-900 border-b pb-3">
                    スタッフ参加リクエスト一覧
                </h1>

                {/* フラッシュメッセージ */}
                {message && (
                    <div className={`p-3 rounded-md border text-center font-medium ${messageColorClass}`}>
                        {message}
                    </div>
                )}
                
                {requests.length === 0 ? (
                    <p className="p-4 text-center text-gray-600 border border-dashed rounded-lg">
                        現在、新しい参加リクエストはありません。
                    </p>
                ) : (
                    // ★ リクエストテーブル
                    <div className="overflow-x-auto shadow-md rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        名前
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        メールアドレス
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        操作
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {requests.map((req) => (
                                    <tr key={req.user_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {req.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {req.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button 
                                                onClick={() => handleAction(req.user_id, 'approve')}
                                                className="px-3 py-1 border border-transparent rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 text-xs"
                                                disabled={!!message} // 処理中は無効化
                                            >
                                                承認
                                            </button>
                                            <button 
                                                onClick={() => handleAction(req.user_id, 'reject')}
                                                className="ml-2 px-3 py-1 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150 text-xs"
                                                disabled={!!message} // 処理中は無効化
                                            >
                                                拒否
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
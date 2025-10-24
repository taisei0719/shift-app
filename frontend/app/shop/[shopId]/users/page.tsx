// frontend/app/shop/[shopId]/users/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/app/context/UserContext'; 
import { api } from '@/lib/api'; 

// データ型定義 (バックエンドのAPIレスポンスに合わせる)
interface ShopUser {
    user_id: number;
    user_name: string;
    role: 'owner' | 'staff' | 'admin';
    is_owner: boolean;
}

interface ShopData {
    id: number;
    name: string;
    location: string;
}

export default function ShopUsersPage() {
    const router = useRouter();
    const params = useParams();

    // params.shopId の安全な抽出と型変換 (useParamsはstring | string[] | undefinedを返すため)
    const rawShopId = Array.isArray(params.shopId) ? params.shopId[0] : params.shopId;
    // rawShopId が存在すれば数値に変換し、なければ null とする
    const shopId = rawShopId ? parseInt(rawShopId) : null;
    
    const { user, loading } = useUser(); 
    
    const [shopData, setShopData] = useState<ShopData | null>(null);
    const [usersInShop, setUsersInShop] = useState<ShopUser[]>([]);
    // APIデータ取得用のローディングステート
    const [isLoading, setIsLoading] = useState(true); 
    const [error, setError] = useState<string | null>(null);

    // 認証とデータ取得
    useEffect(() => {  
        if (loading) return; // Contextのloadingがtrueの間は待機する

        if (!user) {// ユーザーがロード完了後、未ログインの場合はトップへリダイレクト
            router.push('/'); 
            return;
        }

        // ログイン済みだが、店舗未所属の場合はリダイレクト (ここではリターンのみ)
        if (user.shop_id === null) {
            setIsLoading(false);
            return;
        }

        // アクセス権限チェック (URLのshopIdとユーザーの所属shopIdが一致しない場合はエラー)
        if (user.shop_id !== shopId) {
            setError("アクセス権限がありません。所属店舗の情報を確認してください。");
            setIsLoading(false);
            return;
        }

        // 従業員一覧データを取得
        const fetchUsers = async () => {
            try {
                const response = await api.get(`/shops/${shopId}/users`); 
                
                if (response.status === 200) {
                    setShopData(response.data.shop);
                    // オーナーが常にリストの先頭に来るようにソート
                    const sortedUsers = response.data.users.sort((a: ShopUser, b: ShopUser) => {
                        if (a.is_owner && !b.is_owner) return -1;
                        if (!a.is_owner && b.is_owner) return 1;
                        return 0;
                    });
                    setUsersInShop(sortedUsers);
                } else {
                    setError("従業員データの取得に失敗しました。");
                }
            } catch (err) {
                console.error(err);
                setError("サーバーからデータを取得できませんでした。");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [user, loading, shopId, router]);


    // ----------------------------------------------------------------------
    // ★ ローディング/エラー表示
    // ----------------------------------------------------------------------
    const isAdmin = user?.role === 'admin';
    if (loading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-600">データを読み込み中...</p>
            </div>
        );
    }

    // user がロード完了し、isLoading が false になった後、店舗未所属を判定
    if (!user || user.shop_id === null) { // userがnull（未ログイン）の場合はuseEffectでリダイレクト済み
        const register_path = isAdmin ? "/shop_register" : "/staff_shop_register";
        const register_label = isAdmin ? "店舗登録ページへ移動" : "店舗参加（コード入力）へ移動"; 
        
        return (
          <div className="min-h-screen flex flex-col items-center py-10 bg-gray-50">
            <div className="w-full max-w-lg p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200 text-center">
                <h1 className="text-2xl font-bold text-gray-900">店舗未登録</h1>
                <p className="text-gray-600">店舗を登録してシフトを提出しましょう!</p>
                
                <div className="space-y-3 pt-4">
                    {/* 登録・参加ボタン */}
                    <button 
                      onClick={() => router.push(register_path)}
                      className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
                    >
                        {register_label}
                    </button>
                </div>
            </div>
          </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="p-8 bg-white shadow-lg rounded-lg border border-red-300">
                    <h2 className="text-xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
                    <p className="text-red-500">{error}</p>
                    <button 
                        onClick={() => router.back()}
                        className="mt-6 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition duration-150"
                    >
                        戻る
                    </button>
                </div>
            </div>
        );
    }

    // ----------------------------------------------------------------------
    // ★ メインコンテンツ表示
    // ----------------------------------------------------------------------
    return (
        <div className="min-h-screen flex justify-center py-10 bg-gray-50">
            {/* メインコンテナ */}
            <div className="w-full max-w-2xl p-8 space-y-6 bg-white shadow-xl rounded-lg border border-gray-200">
                
                {/* ヘッダー */}
                <h1 className="text-3xl font-extrabold text-gray-900 border-b pb-3">
                    {shopData?.name || "店舗"} の従業員一覧
                </h1>
                
                <p className="text-gray-600">
                    現在、<span className="font-semibold text-indigo-600">{usersInShop.length}</span> 名のスタッフが登録されています。
                </p>

                {/* 従業員リスト */}
                <div className="space-y-3">
                    {usersInShop.map((shopUser) => (
                        <div 
                            key={shopUser.user_id} 
                            className="p-4 border rounded-xl flex items-center justify-between shadow-sm bg-gray-50 hover:bg-white transition duration-200"
                        >
                            <div className="flex items-center">
                                {/* アイコン (イニシャル) */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 font-bold text-lg text-white 
                                    ${shopUser.is_owner ? 'bg-indigo-600' : 'bg-gray-500'}`}
                                >
                                    {shopUser.user_name.charAt(0)}
                                </div>

                                {/* ユーザー名 */}
                                <span className="text-lg font-semibold text-gray-800">
                                    {shopUser.user_name}
                                </span>

                                {/* オーナー表示のタグ */}
                                {shopUser.is_owner && (
                                    <span className="ml-3 px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800">
                                        オーナー
                                    </span>
                                )}
                                
                                {/* 自分が表示されている場合に「あなた」と表示 */}
                                {shopUser.user_id === user?.user_id && (
                                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-md">
                                        あなた
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 戻るボタン */}
                <button 
                    onClick={() => router.back()} 
                    className="mt-6 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition duration-150 border border-gray-300"
                >
                    &larr; 戻る
                </button>
            </div>
        </div>
    );
}
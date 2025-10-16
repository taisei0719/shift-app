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

// Next.jsのビルドエラー回避のため、型はインラインで定義
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

        // ログイン済みだが、店舗未所属の場合はリダイレクト
        if (user.shop_id === null) {
            // 店舗詳細のページと同じロジックをここに追加
            // router.push(`/shop/${shopId}/page`); 
            return;
        }

        // アクセス権限チェック (URLのshopIdとユーザーの所属shopIdが一致しない場合はエラー)
        // URLパラメータはstring、user.shop_idはnumberなので型を合わせる
        if (user.shop_id !== shopId) {
            setError("アクセス権限がありません。所属店舗の情報を確認してください。");
            setIsLoading(false);
            return;
        }

        // 従業員一覧データを取得
        const fetchUsers = async () => {
            try {
                // api.get() は withCredentials が設定されたクライアントであることを前提
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
    // 依存配列に loading を追加する
    }, [user, loading, shopId, router]);


    // Contextの loading と APIデータ取得の isLoading のどちらかがtrueなら表示
    if (loading || isLoading) {
        return <div className="p-6 text-center">データを読み込み中...</div>;
    }

    if (error) {
        return <div className="p-6 text-red-500">エラー: {error}</div>;
    }

    return (
        <div className="p-6 shop-users-container">
            <h1 className="text-3xl font-bold mb-4">{shopData?.name || "店舗"} の従業員一覧</h1>
            <p className="mb-6 text-gray-600">現在、{usersInShop.length} 名のスタッフが登録されています。</p>

            <div className="space-y-3">
                {usersInShop.map((shopUser) => (
                    <div 
                        key={shopUser.user_id} 
                        className="p-4 border rounded-lg flex items-center justify-between shadow-sm bg-white"
                    >
                        <div className="flex items-center">
                            {/* アイコンまたはイニシャル表示 */}
                            {/* <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 text-white ${shopUser.is_owner ? 'bg-indigo-600' : 'bg-gray-400'}`}>
                                {shopUser.user_name.charAt(0)}
                            </div> */}

                            <span className="text-lg font-medium">
                                {shopUser.user_name}
                                {/* ★ オーナー表示のタグ ★ */}
                                {shopUser.is_owner && (
                                    <span className="ml-3 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                        オーナー
                                    </span>
                                )}
                                {/* (オプション) 自分が表示されている場合に「あなた」と表示 */}
                                {shopUser.user_id === user?.user_id && (
                                    <span className="ml-2 text-sm text-gray-500">(あなた)</span>
                                )}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <button 
                onClick={() => router.back()} 
                className="mt-6 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
                戻る
            </button>
        </div>
    );
}
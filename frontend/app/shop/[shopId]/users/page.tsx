// frontend/app/shop/[shopId]/users/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface UserListPageProps {
    params: {
        shopId: string;
    };
}

export default function ShopUsersPage({ params }: UserListPageProps) {
    const router = useRouter();
    const { user, isLoading: isUserLoading } = useUser();
    const shopId = parseInt(params.shopId);

    const [shopData, setShopData] = useState<ShopData | null>(null);
    const [usersInShop, setUsersInShop] = useState<ShopUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 認証とデータ取得
    useEffect(() => {
        if (isUserLoading || !user) return;
        
        // ユーザーがまだロードされていない、または店舗未所属の場合はリダイレクト
        if (user.shop_id === null) {
            router.push(`/shop/${shopId}/page`); // 元の未所属ページへ
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
    }, [user, isUserLoading, shopId, router]);


    if (isLoading || isUserLoading) {
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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 text-white ${shopUser.is_owner ? 'bg-indigo-600' : 'bg-gray-400'}`}>
                                {shopUser.user_name.charAt(0)}
                            </div>

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
                        {/* (ここに編集ボタンなどを追加しても良い) */}
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
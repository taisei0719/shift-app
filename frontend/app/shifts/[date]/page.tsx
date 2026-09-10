// frontend/app/shifts/[date]/page.tsx
// このファイルはServer Componentです（use clientは不要）

import ShiftViewClient from "./_ShiftViewClient"; 

// パラメーターを受け取るための型定義（Next.js 15ではparamsはPromise）
interface PageProps {
    params: Promise<{
        date: string; // YYYY-MM-DD
    }>;
}

/**
 * スタッフ向け確定シフト確認ページ (Server Component)
 * URLから日付パラメータを取得し、クライアントコンポーネントに渡します。
 */
export default async function StaffShiftViewPage(props: PageProps) {
    const { date } = await props.params;

    // クライアントコンポーネントに date だけを渡す
    return <ShiftViewClient date={date} />;
}
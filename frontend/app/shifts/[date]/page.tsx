// frontend/app/shifts/[date]/page.tsx
// このファイルはServer Componentです（use clientは不要）

import ShiftViewClient from "./_ShiftViewClient"; 

// パラメーターを受け取るための型定義
interface PageProps {
    params: {
        date: string; // YYYY-MM-DD
    };
}

/**
 * スタッフ向け確定シフト確認ページ (Server Component)
 * URLから日付パラメータを取得し、クライアントコンポーネントに渡します。
 */
export default function StaffShiftViewPage(props: any) {
    const { date } = props.params;

    // クライアントコンポーネントに date だけを渡す
    return <ShiftViewClient date={date} />;
}
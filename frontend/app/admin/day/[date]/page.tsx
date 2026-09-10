// frontend/app/admin/day/[date]/page.tsx
//"use client"

import ShiftAdjustClient from "./_ShiftAdjustClient"; // 新しいクライアントコンポーネントをインポート

// パラメーターを受け取るための型定義（Next.js 15ではparamsはPromise）
interface PageProps {
    params: Promise<{
        date: string; // YYYY-MM-DD
    }>;
}

// サーバーコンポーネント: paramsを安全に取得し、クライアントコンポーネントに渡す
export default async function AdminShiftAdjustPage(props: PageProps) {
    const { date } = await props.params;
    return <ShiftAdjustClient date={date} />;
}

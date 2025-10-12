// frontend/app/admin/day/[date]/page.tsx
//"use client"

import { useUser } from "@/app/context/UserContext";
import ShiftAdjustClient from "./_ShiftAdjustClient"; // 新しいクライアントコンポーネントをインポート

// パラメーターを受け取るための型定義
interface PageProps {
    params: {
        date: string; // YYYY-MM-DD
    };
}

// サーバーコンポーネント: paramsを安全に取得し、クライアントコンポーネントに渡す
export default async function AdminShiftAdjustPage(props: any) {
    const { date } = props.params;
    return <ShiftAdjustClient date={date} />;
}

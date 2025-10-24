// frontend/app/staff/shifts/page.tsx
import ShiftCalendarClient from "./_ShiftCalendarClient";
import { Suspense } from 'react';

// サーバーで動作する非同期関数
export default function StaffShiftsPage() {
    // 常に現在の年月をデフォルトとして使用
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // getMonth()は0から始まるため +1

    return (
        <div className="p-4">
            {/* ユーザー情報がロードされるのを待機する */}
            <Suspense fallback={
                <div className="text-center py-10">
                    <p className="text-gray-500">情報を読み込み中...</p>
                    {/* スピナーなど */}
                </div>
            }>
                <h1 className="text-2xl font-bold mb-6">シフトカレンダー・提出</h1>
                {/* Client Component に年月の情報とAPIを処理するロジックを渡す */}
                {/* ★ 修正なし: 実際のロジックは _ShiftCalendarClient に移す */}
                <ShiftCalendarClient initialYear={currentYear} initialMonth={currentMonth} />
            </Suspense>
        </div>
    );
}
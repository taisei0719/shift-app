// frontend/app/staff/shifts/page.tsx
import ShiftCalendarClient from "./_ShiftCalendarClient";
import { format } from 'date-fns';

// サーバーで動作する非同期関数
export default function StaffShiftsPage() {
    // 常に現在の年月をデフォルトとして使用
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // getMonth()は0から始まるため +1

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-6">シフトカレンダー・提出</h1>
            {/* Client Component に年月の情報とAPIを処理するロジックを渡す */}
            <ShiftCalendarClient initialYear={currentYear} initialMonth={currentMonth} />
        </div>
    );
}
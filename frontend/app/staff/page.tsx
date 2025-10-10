// frontend/app/staff/page.tsx

import { redirect } from 'next/navigation';

// このページにアクセスが来たら、統合シフトカレンダーのページにリダイレクトする
export default function StaffHomePageRedirect() {
    // ★ Next.js の Server Component の機能を使ってリダイレクトをかける
    redirect('/shifts');
}
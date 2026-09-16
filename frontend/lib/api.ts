// frontend/lib/api.ts

import axios from "axios";

export const TOKEN_STORAGE_KEY = "access_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL, // 環境変数から取得
  withCredentials: true, // Cookie / セッション保持
});

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// SafariのITP等でクロスサイトCookieがブロックされる端末向けに、
// localStorageに保存したトークンをAuthorizationヘッダーでも送る
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Cookie認証にフォールバックした場合に備え、CSRFダブルサブミット用トークンも付与する
    const csrfToken = getCookie("csrf_access_token");
    if (csrfToken) {
      config.headers = config.headers ?? {};
      config.headers["X-CSRF-TOKEN"] = csrfToken;
    }
  }
  return config;
});

// APIエラーレスポンス（{ "error": "..." }）からメッセージを取り出す共通ヘルパー。
// axios以外の例外やレスポンス形式が想定外の場合はfallbackを返す。
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || fallback;
  }
  return fallback;
}
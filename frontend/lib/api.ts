// frontend/lib/api.ts

import axios from "axios";

export const TOKEN_STORAGE_KEY = "access_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL, // 環境変数から取得
  withCredentials: true, // Cookie / セッション保持
});

// SafariのITP等でクロスサイトCookieがブロックされる端末向けに、
// localStorageに保存したトークンをAuthorizationヘッダーでも送る
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL, // 環境変数から取得
  withCredentials: true, // Cookie / セッション保持
});

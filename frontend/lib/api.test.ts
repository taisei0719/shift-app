import { describe, it, expect, afterEach } from "vitest";
import { api, TOKEN_STORAGE_KEY } from "./api";

describe("api request interceptor - CSRF header", () => {
  const originalAdapter = api.defaults.adapter;

  afterEach(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    document.cookie = "csrf_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    api.defaults.adapter = originalAdapter;
  });

  it("csrf_access_tokenのcookieからX-CSRF-TOKENヘッダーを自動付与する", async () => {
    document.cookie = "csrf_access_token=test-csrf-value; path=/;";

    let capturedHeaders: Record<string, unknown> | undefined;
    api.defaults.adapter = async (config) => {
      capturedHeaders = config.headers as unknown as Record<string, unknown>;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.get("/dummy");

    expect(capturedHeaders?.["X-CSRF-TOKEN"]).toBe("test-csrf-value");
  });

  it("cookieが無い場合はX-CSRF-TOKENヘッダーを付与しない", async () => {
    let capturedHeaders: Record<string, unknown> | undefined;
    api.defaults.adapter = async (config) => {
      capturedHeaders = config.headers as unknown as Record<string, unknown>;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.get("/dummy");

    expect(capturedHeaders?.["X-CSRF-TOKEN"]).toBeUndefined();
  });
});

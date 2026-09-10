import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api";
import { UserProvider, useUser } from "./UserContext";

function Probe() {
  const { user, loading } = useUser();
  if (loading) return <p>loading</p>;
  return <p>{user ? `user:${user.user_name}` : "no-user"}</p>;
}

describe("UserProvider", () => {
  it("マウント時にセッションを取得し、成功時はuserをセットする", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { user: { user_id: 1, user_name: "Taro", role: "staff" } },
    });

    render(
      <UserProvider>
        <Probe />
      </UserProvider>
    );

    expect(screen.getByText("loading")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("user:Taro")).toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith("/session");
  });

  it("セッション取得に失敗した場合はuserをnullのままにする", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("network error"));

    render(
      <UserProvider>
        <Probe />
      </UserProvider>
    );

    await waitFor(() => expect(screen.getByText("no-user")).toBeInTheDocument());
  });
});

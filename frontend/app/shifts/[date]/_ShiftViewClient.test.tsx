import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
}));

const useUserMock = vi.fn();
vi.mock("@/app/context/UserContext", () => ({
  useUser: () => useUserMock(),
}));

import { api } from "@/lib/api";
import ShiftViewClient from "./_ShiftViewClient";

describe("ShiftViewClient", () => {
  it("未ログインの場合は認証エラーを表示する", async () => {
    useUserMock.mockReturnValue({ user: null, loading: false });

    render(<ShiftViewClient date="2026-10-15" />);

    await waitFor(() =>
      expect(screen.getByText(/認証が必要です。ログインしてください。/)).toBeInTheDocument()
    );
  });

  it("確定シフトがない場合はその旨を表示する", async () => {
    useUserMock.mockReturnValue({ user: { user_name: "Taro" }, loading: false });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { confirmed_shifts: [] } });

    render(<ShiftViewClient date="2026-10-15" />);

    await waitFor(() =>
      expect(screen.getByText("この日の確定シフトはありません。")).toBeInTheDocument()
    );
    expect(api.get).toHaveBeenCalledWith("/shifts/2026-10-15");
  });

  it("確定シフトがある場合は時間帯を表示する", async () => {
    useUserMock.mockReturnValue({ user: { user_name: "Taro" }, loading: false });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        confirmed_shifts: [
          {
            id: 1,
            user_id: 1,
            shop_id: 1,
            shift_date: "2026-10-15",
            start_time: "09:00",
            end_time: "17:00",
            shift_type: "confirmed",
            user_name: "Taro",
          },
        ],
      },
    });

    render(<ShiftViewClient date="2026-10-15" />);

    await waitFor(() => expect(screen.getByText("09:00 - 17:00")).toBeInTheDocument());
  });
});

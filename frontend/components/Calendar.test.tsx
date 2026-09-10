import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("year=2026&month=10"),
}));

import Calendar from "./Calendar";

describe("Calendar", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("URLパラメータの年月を見出しに表示する", () => {
    render(<Calendar base_path="/staff/day" current_page_path="/staff" />);

    expect(screen.getByText("2026年10月")).toBeInTheDocument();
  });

  it("当月の日付をクリックすると詳細ページへ遷移する", () => {
    render(<Calendar base_path="/staff/day" current_page_path="/staff" />);

    fireEvent.click(screen.getByText("15"));

    expect(pushMock).toHaveBeenCalledWith("/staff/day/2026-10-15");
  });

  it("シフト状況に応じたステータステキストを表示する", () => {
    render(
      <Calendar
        base_path="/staff/day"
        current_page_path="/staff"
        statusData={{ "2026-10-15": "confirmed", "2026-10-16": "requested" }}
      />
    );

    expect(screen.getByText("確定済")).toBeInTheDocument();
    expect(screen.getByText("未確定")).toBeInTheDocument();
  });
});

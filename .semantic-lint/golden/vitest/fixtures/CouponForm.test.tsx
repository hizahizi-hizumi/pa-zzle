import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CouponForm } from "./CouponForm";

afterEach(cleanup);

describe("割引が確定している場合", () => {
  let onApply: (code: string) => void;

  beforeEach(() => {
    onApply = vi.fn();
    render(<CouponForm defaultCode="SPRING" discount={500} onApply={onApply} />);
  });

  test("割引額を表示すること", () => {
    const discount = screen.getByRole("button", { name: "500円引き" });

    expect(discount).toBeTruthy();
  });

  test("入力したコードで適用を通知すること", () => {
    const input = screen.getByText("クーポンコード").nextElementSibling;
    fireEvent.change(input as Element, { target: { value: "SUMMER" } });

    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    expect(onApply).toHaveBeenCalledWith("SUMMER");
  });

  test("適用済みの案内を表示すること", () => {
    const notice = screen.getByText("クーポンを適用しました");

    expect(notice).toBeTruthy();
  });

  test("クーポンを外す操作を提供すること", () => {
    const remove = screen.getByRole("button", { name: "クーポンを外す" });

    expect(remove).toBeTruthy();
  });
});

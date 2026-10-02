import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";

afterEach(cleanup);

describe("DifficultySelectionHeading", () => {
  const title = "テストパズル";

  beforeEach(() => {
    render(
      <DifficultySelectionHeading
        title={title}
        renderHowToPlayDialog={({ open, onClose }) => (
          <HowToPlayDialog
            open={open}
            description="すべてのマスを埋める。"
            onClose={onClose}
          >
            <li>ルール</li>
          </HowToPlayDialog>
        )}
      />,
    );
  });

  test("ゲーム名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1, name: title });

    expect(heading).toBeTruthy();
  });

  test("遊び方を最初は開かないこと", () => {
    const dialog = screen.queryByRole("dialog", { name: "遊び方" });

    expect(dialog).toBeNull();
  });

  describe("遊び方ボタンを押した場合", () => {
    beforeEach(() => {
      fireEvent.click(screen.getByRole("button", { name: "遊び方" }));
    });

    test("遊び方を開くこと", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      expect(dialog).toBeTruthy();
    });

    test("閉じるボタンで遊び方を閉じること", () => {
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      const dialog = screen.queryByRole("dialog", { name: "遊び方" });

      expect(dialog).toBeNull();
    });
  });
});

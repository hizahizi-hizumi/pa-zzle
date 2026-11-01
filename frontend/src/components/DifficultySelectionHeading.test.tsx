import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";

afterEach(cleanup);

describe("DifficultySelectionHeading", () => {
  const title = "テストパズル";

  beforeEach(() => {
    render(
      <MemoryRouter>
        <DifficultySelectionHeading
          title={title}
          gameId="nanpure"
          renderHowToPlayDialog={({ open, onClose }) => (
            <HowToPlayDialog
              open={open}
              description="すべてのマスを埋める。"
              onClose={onClose}
            >
              <li>ルール</li>
            </HowToPlayDialog>
          )}
        />
      </MemoryRouter>,
    );
  });

  test("ゲーム名を見出しに出すこと", () => {
    const heading = screen.getByRole("heading", { level: 1, name: title });

    expect(heading).toBeTruthy();
  });

  test("そのゲームの図鑑への導線を出すこと", () => {
    const zukanLink = screen.getByRole("link", { name: "図鑑" });

    expect(zukanLink.getAttribute("href")).toBe("/puzzles/nanpure/zukan");
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

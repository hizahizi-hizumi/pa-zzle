import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayDialog } from "@/components/HowToPlayDialog";

afterEach(cleanup);

describe("HowToPlayDialog", () => {
  const description = "すべてのマスを埋める。";
  const ruleItems = ["ルール1", "ルール2"] as const;

  describe("開いている場合", () => {
    let onClose: () => void;

    beforeEach(() => {
      onClose = vi.fn();
      render(
        <HowToPlayDialog open description={description} onClose={onClose}>
          {ruleItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </HowToPlayDialog>,
      );
    });

    test("目的を表示すること", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      const purpose = within(dialog).getByText(description);

      expect(purpose).toBeTruthy();
    });

    test("ルールと操作を渡した順に並べること", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      const items = within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent);

      expect(items).toEqual(ruleItems);
    });

    test("閉じるボタンで閉じる操作を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    test("Escape で閉じる操作を通知すること", () => {
      fireEvent.keyDown(screen.getByRole("dialog", { name: "遊び方" }), {
        key: "Escape",
      });

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("閉じている場合", () => {
    beforeEach(() => {
      render(
        <HowToPlayDialog
          open={false}
          description={description}
          onClose={vi.fn()}
        >
          <li>ルール1</li>
        </HowToPlayDialog>,
      );
    });

    test("遊び方を表示しないこと", () => {
      const dialog = screen.queryByRole("dialog", { name: "遊び方" });

      expect(dialog).toBeNull();
    });
  });
});

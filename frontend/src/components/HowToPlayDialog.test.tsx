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

    test("開いたときに、閉じるボタンではなく見出しにフォーカスを置くこと", () => {
      const heading = screen.getByRole("heading", { name: "遊び方" });

      expect(document.activeElement).toBe(heading);
      expect(heading.getAttribute("tabindex")).toBe("-1");
    });

    test("見出しから Tab で最初に進む先を、閉じるボタンにすること", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      const [firstTabbable] = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );

      expect(firstTabbable?.getAttribute("aria-label")).toBe("閉じる");
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

  describe("チュートリアルを開く操作を渡した場合", () => {
    let onOpenTutorial: () => void;

    beforeEach(() => {
      onOpenTutorial = vi.fn();
      render(
        <HowToPlayDialog
          open
          description={description}
          onClose={vi.fn()}
          onOpenTutorial={onOpenTutorial}
        >
          <li>ルール1</li>
        </HowToPlayDialog>,
      );
    });

    test("目的の一文の下のチュートリアルのボタンで、チュートリアルを開く操作を通知すること", () => {
      fireEvent.click(
        within(screen.getByRole("dialog", { name: "遊び方" })).getByRole(
          "button",
          { name: "チュートリアルで遊んで覚える" },
        ),
      );

      expect(onOpenTutorial).toHaveBeenCalledOnce();
    });
  });

  describe("チュートリアルを開く操作を渡さない場合", () => {
    beforeEach(() => {
      render(
        <HowToPlayDialog open description={description} onClose={vi.fn()}>
          <li>ルール1</li>
        </HowToPlayDialog>,
      );
    });

    test("チュートリアルのボタンを出さないこと", () => {
      const tutorialButtons = screen.queryAllByRole("button", {
        name: /チュートリアル/,
      });

      expect(tutorialButtons).toEqual([]);
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

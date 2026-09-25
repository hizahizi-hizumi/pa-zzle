import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { TakuzuPlay } from "@/games/takuzu/ui/TakuzuPlay";

const cells: TakuzuCellView[] = [
  { cell: "a", given: true, violated: false },
  { cell: "b", given: false, violated: false },
  { cell: "b", given: false, violated: false },
  { cell: "a", given: false, violated: false },
];

afterEach(() => {
  cleanup();
});

describe("TakuzuPlay", () => {
  const callbacks = {
    onCycleCell: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onBackToHome: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      render(
        <TakuzuPlay
          difficulty="2"
          size={2}
          cells={cells}
          status="playing"
          elapsedMs={65_000}
          {...callbacks}
        />,
      );
    });

    test("表示名と難易度と経過時間を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "バイナリパズル" });
      const difficulty = screen.getByText("レベル 2");
      const elapsedTime = screen.getByText("01:05");

      expect(heading).toBeTruthy();
      expect(difficulty).toBeTruthy();
      expect(elapsedTime).toBeTruthy();
    });

    test("盤面を戻すボタンで盤面を戻す操作を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "盤面を戻す" }));

      expect(callbacks.onRestart).toHaveBeenCalledOnce();
    });

    test("完成の表示を出さないこと", () => {
      const result = screen.queryByRole("status");

      expect(result).toBeNull();
    });
  });

  describe("完成した場合", () => {
    beforeEach(() => {
      render(
        <TakuzuPlay
          difficulty="2"
          size={2}
          cells={cells}
          status="cleared"
          elapsedMs={65_000}
          {...callbacks}
        />,
      );
    });

    test("完成を知らせること", () => {
      const result = screen.getByRole("status");

      expect(result.textContent).toContain("完成！");
    });

    test("盤面のマスを操作できないこと", () => {
      const result = within(
        screen.getByRole("group", { name: "バイナリパズル盤面" }),
      )
        .getAllByRole("button")
        .every((cell) => (cell as HTMLButtonElement).disabled);

      expect(result).toBe(true);
    });

    test("同じ問題をもう一度ボタンで再プレイを通知すること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "同じ問題をもう一度" }),
      );

      expect(callbacks.onReplay).toHaveBeenCalledOnce();
    });
  });
});

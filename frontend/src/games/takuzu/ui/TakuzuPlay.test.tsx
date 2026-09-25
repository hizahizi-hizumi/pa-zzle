import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TakuzuProgress } from "@/games/takuzu/play/use-takuzu-play";
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
    onPlaceCell: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearingComplete: vi.fn(),
    onBackToHome: vi.fn(),
  };

  function renderPlay(progress: TakuzuProgress) {
    render(
      <TakuzuPlay
        difficulty="2"
        size={2}
        cells={cells}
        progress={progress}
        elapsedMs={65_000}
        {...callbacks}
      />,
    );
  }

  function openMenu() {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay("playing");
    });

    test("表示名と難易度と経過時間を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "バイナリパズル" });
      const difficulty = screen.getByText("難易度 2");
      const elapsedTime = screen.getByText("時間").parentElement;

      expect(heading).toBeTruthy();
      expect(difficulty).toBeTruthy();
      expect(elapsedTime?.textContent).toBe("時間01:05");
    });

    test("戻るボタンでホームへの移動を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "ホームへ戻る" }));

      expect(callbacks.onBackToHome).toHaveBeenCalledOnce();
    });

    const menuCases = [
      ["盤面を戻す", "onRestart"],
      ["リセット", "onReplay"],
      ["ホーム", "onBackToHome"],
    ] as const;

    test.each(menuCases)(
      "メニューの %s で対応する操作を通知すること",
      (itemName, callbackName) => {
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    const unconnectedMenuItems = ["別の問題", "難易度変更", "検証情報"];

    test.each(unconnectedMenuItems)(
      "つなぎ先を渡さなければメニューへ %s を表示しないこと",
      (itemName) => {
        openMenu();

        const result = screen.queryByRole("menuitem", { name: itemName });

        expect(result).toBeNull();
      },
    );

    test("完成の表示を出さないこと", () => {
      const result = screen.queryByRole("status");

      expect(result).toBeNull();
    });
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay("clearing");
    });

    test("盤面のマスを操作できないこと", () => {
      const result = within(screen.getByRole("group", { name: "盤面" }))
        .getAllByRole("button")
        .every((cell) => (cell as HTMLButtonElement).disabled);

      expect(result).toBe(true);
    });

    test("完成の表示をまだ出さないこと", () => {
      const result = screen.queryByRole("status");

      expect(result).toBeNull();
    });
  });

  describe("完成演出が終わった場合", () => {
    beforeEach(() => {
      renderPlay("result");
    });

    test("完成を知らせること", () => {
      const result = screen.getByRole("status");

      expect(result.textContent).toContain("完成！");
    });

    test("同じ問題をもう一度ボタンで再プレイを通知すること", () => {
      fireEvent.click(
        within(screen.getByRole("status")).getByRole("button", {
          name: "同じ問題をもう一度",
        }),
      );

      expect(callbacks.onReplay).toHaveBeenCalledOnce();
    });
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import type { GameProgress } from "@/games/play";

afterEach(cleanup);

function openPlayMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function openHowToPlay(): void {
  openPlayMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
}

type GamePlayFrameProps = ComponentProps<typeof GamePlayFrame<string>>;

function renderFrame(
  progress: GameProgress,
  result: string | null,
  overrides: Partial<
    Pick<GamePlayFrameProps, "renderTutorial" | "entryAnimation" | "onReplay">
  > = {},
): void {
  const props: GamePlayFrameProps = {
    progress,
    result,
    title: "テストパズル",
    metrics: [{ type: "elapsed-time", elapsedMs: 0 }],
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
    renderResultScreen: (clearedResult) => <p>結果 {clearedResult}</p>,
    renderHowToPlayDialog: ({ open, onOpenTutorial }) =>
      open ? (
        <section aria-label="遊び方">
          {onOpenTutorial ? (
            <button type="button" onClick={onOpenTutorial}>
              遊び方からチュートリアルへ
            </button>
          ) : null}
        </section>
      ) : null,
    renderSettingsDialog: ({ open, onClose }) =>
      open ? (
        <button type="button" onClick={onClose}>
          設定を閉じる
        </button>
      ) : null,
    children: <main>盤面</main>,
    ...overrides,
  };
  render(<GamePlayFrame {...props} />);
}

describe("GamePlayFrame", () => {
  describe("結果表示へ進み、評価がある場合", () => {
    beforeEach(() => {
      renderFrame("result", "100点");
    });

    test("盤面の代わりに結果画面を描くこと", () => {
      const resultScreen = screen.queryByText("結果 100点");
      const board = screen.queryByText("盤面");

      expect(resultScreen).not.toBeNull();
      expect(board).toBeNull();
    });
  });

  const boardCases = [
    ["プレイ中", "playing", null],
    ["完成演出中", "clearing", "100点"],
    ["結果表示へ進んだが評価が無い", "result", null],
  ] as const;

  describe.each(boardCases)("%sの場合", (_, progress, result) => {
    beforeEach(() => {
      renderFrame(progress, result);
    });

    test("見出しと盤面を描き、結果画面を描かないこと", () => {
      const heading = screen.queryByRole("heading", { name: "テストパズル" });
      const board = screen.queryByText("盤面");
      const resultScreen = screen.queryByText(/^結果/);

      expect(heading).not.toBeNull();
      expect(board).not.toBeNull();
      expect(resultScreen).toBeNull();
    });
  });

  describe("既定の入場演出", () => {
    beforeEach(() => {
      renderFrame("playing", null);
    });

    test("盤面の表示時にフェードインすること", () => {
      const content = screen.getByText("盤面").parentElement;

      expect(content?.classList.contains("animate-in")).toBe(true);
      expect(content?.classList.contains("fade-in")).toBe(true);
    });
  });

  describe("入場演出を無効にした場合", () => {
    beforeEach(() => {
      renderFrame("playing", null, { entryAnimation: false });
    });

    test("盤面をフェードさせずに表示すること", () => {
      const content = screen.getByText("盤面").parentElement;

      expect(content?.classList.contains("animate-in")).toBe(false);
      expect(content?.classList.contains("fade-in")).toBe(false);
    });
  });

  describe("リセットを渡した場合", () => {
    const onReplay = vi.fn();

    beforeEach(() => {
      renderFrame("playing", null, { onReplay });
    });

    test("メニューのリセットで、リセットを通知すること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "リセット" }));

      expect(onReplay).toHaveBeenCalledOnce();
    });
  });

  describe("リセットを渡さない場合", () => {
    beforeEach(() => {
      renderFrame("playing", null, { onReplay: undefined });
    });

    test("メニューにリセットを出さないこと", () => {
      openPlayMenu();

      const item = screen.queryByRole("menuitem", { name: "リセット" });

      expect(item).toBeNull();
    });
  });

  describe("設定メニューを開く場合", () => {
    beforeEach(() => {
      renderFrame("playing", null);
    });

    test("設定を開いて閉じられること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "設定" }));
      const opened = screen.queryByRole("button", { name: "設定を閉じる" });
      fireEvent.click(screen.getByRole("button", { name: "設定を閉じる" }));
      const closed = screen.queryByRole("button", { name: "設定を閉じる" });

      expect(opened).not.toBeNull();
      expect(closed).toBeNull();
    });
  });

  describe("チュートリアルを渡さない場合", () => {
    beforeEach(() => {
      renderFrame("playing", null);
    });

    test("遊び方にチュートリアルを開く操作を渡さないこと", () => {
      openHowToPlay();

      const howToPlay = screen.queryByRole("region", { name: "遊び方" });
      const tutorialEntry = screen.queryByRole("button", {
        name: "遊び方からチュートリアルへ",
      });

      expect(howToPlay).not.toBeNull();
      expect(tutorialEntry).toBeNull();
    });
  });

  describe("チュートリアルを渡した場合", () => {
    beforeEach(() => {
      renderFrame("playing", null, {
        renderTutorial: ({ open, onClose }) =>
          open ? (
            <button type="button" onClick={onClose}>
              チュートリアルを閉じる
            </button>
          ) : null,
      });
    });

    test("チュートリアルを最初は開かないこと", () => {
      const tutorial = screen.queryByRole("button", {
        name: "チュートリアルを閉じる",
      });

      expect(tutorial).toBeNull();
    });

    test("メニューにチュートリアルの項目を出さないこと", () => {
      openPlayMenu();

      const item = screen.queryByRole("menuitem", { name: "チュートリアル" });

      expect(item).toBeNull();
    });

    test("遊び方のチュートリアルを開く操作で、遊び方を閉じてチュートリアルを開き、閉じる操作で閉じること", () => {
      openHowToPlay();
      fireEvent.click(
        screen.getByRole("button", { name: "遊び方からチュートリアルへ" }),
      );
      const howToPlay = screen.queryByRole("region", { name: "遊び方" });
      const openedTutorial = screen.queryByRole("button", {
        name: "チュートリアルを閉じる",
      });
      fireEvent.click(
        screen.getByRole("button", { name: "チュートリアルを閉じる" }),
      );
      const closedTutorial = screen.queryByRole("button", {
        name: "チュートリアルを閉じる",
      });

      expect(howToPlay).toBeNull();
      expect(openedTutorial).not.toBeNull();
      expect(closedTutorial).toBeNull();
    });
  });
});

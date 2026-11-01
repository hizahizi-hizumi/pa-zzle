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

function renderFrame(
  progress: GameProgress,
  result: string | null,
  renderTutorial?: ComponentProps<
    typeof GamePlayFrame<string>
  >["renderTutorial"],
): void {
  const props: ComponentProps<typeof GamePlayFrame<string>> = {
    progress,
    result,
    title: "テストパズル",
    metrics: [{ type: "elapsed-time", elapsedMs: 0 }],
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    renderResultScreen: (clearedResult) => <p>結果 {clearedResult}</p>,
    renderHowToPlayDialog: () => null,
    renderTutorial,
    children: <main>盤面</main>,
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

  describe("チュートリアルを渡さない場合", () => {
    beforeEach(() => {
      renderFrame("playing", null);
    });

    test("メニューにチュートリアルの項目を出さないこと", () => {
      openPlayMenu();

      const item = screen.queryByRole("menuitem", { name: "チュートリアル" });

      expect(item).toBeNull();
    });
  });

  describe("チュートリアルを渡した場合", () => {
    beforeEach(() => {
      renderFrame("playing", null, ({ open, onClose }) =>
        open ? (
          <button type="button" onClick={onClose}>
            チュートリアルを閉じる
          </button>
        ) : null,
      );
    });

    test("チュートリアルを最初は開かないこと", () => {
      const tutorial = screen.queryByRole("button", {
        name: "チュートリアルを閉じる",
      });

      expect(tutorial).toBeNull();
    });

    test("メニューのチュートリアルで開き、閉じる操作で閉じること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "チュートリアル" }));
      const openedTutorial = screen.queryByRole("button", {
        name: "チュートリアルを閉じる",
      });
      fireEvent.click(
        screen.getByRole("button", { name: "チュートリアルを閉じる" }),
      );
      const closedTutorial = screen.queryByRole("button", {
        name: "チュートリアルを閉じる",
      });

      expect(openedTutorial).not.toBeNull();
      expect(closedTutorial).toBeNull();
    });
  });
});

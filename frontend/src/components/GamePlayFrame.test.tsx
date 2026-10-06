import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import type { GameProgress } from "@/games/play";

afterEach(cleanup);

function renderFrame(progress: GameProgress, result: string | null): void {
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
});

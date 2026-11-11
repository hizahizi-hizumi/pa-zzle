import {
  cleanup,
  fireEvent,
  render as renderWithoutRouter,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";

import type { HakoiriMusumeResult } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";
import { HakoiriMusumePlay } from "@/games/hakoiri-musume/ui/HakoiriMusumePlay";
import type { GameProgress } from "@/games/play";

/** 結果画面はブランドの帯とパズル選択からホームへ戻るリンクを持つので、ルーターの中で描く。 */
function render(ui: ReactElement) {
  return renderWithoutRouter(ui, { wrapper: MemoryRouter });
}

/** 合意の易しい例。 */
const pieces = parseHakoiriMusumeBoard("vAAvwAAwv..vwhiws..s")!;

// 最短13手・準備6手。基準時間は 10秒 + 13手 × 2.5秒 + 6手 × 2.5秒 = 57.5秒。
const result: HakoiriMusumeResult = {
  elapsedMs: 80_000,
  moveCount: 20,
  completionMoveCount: 16,
  undoCount: 2,
  restartCount: 1,
  optimalMoveCount: 13,
  preparationLength: 6,
  moveDelta: 7,
  speedRule: { fullScoreMs: 57_500, zeroScoreMs: 115_000 },
  timeDeltaMs: 22_500,
  score: { total: 68, breakdown: { efficiency: 50, speed: 18 } },
};

afterEach(cleanup);

describe("HakoiriMusumePlay", () => {
  const callbacks = {
    onMovePiece: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToHome: vi.fn(),
  };

  function renderPlay(progress: GameProgress = "playing") {
    return render(
      <HakoiriMusumePlay
        difficulty="1"
        progress={progress}
        result={progress === "result" ? result : null}
        recordFeedback={{ kind: "none" }}
        elapsedMs={65_000}
        pieces={pieces}
        moveCount={7}
        stepNotice={null}
        canUndo
        canRestart
        {...callbacks}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay();
    });

    test("ゲーム名と手数・経過時間を表示し、最短手数は見せないこと", () => {
      const heading = screen.getByRole("heading", { name: "箱入り娘" });
      const moveCount = screen.getByText("手数").parentElement;
      const elapsedTime = screen.getByText("時間").parentElement;
      const optimal = screen.queryByText(/最短/);

      expect(heading).toBeTruthy();
      expect(moveCount?.textContent).toBe("手数7");
      expect(elapsedTime?.textContent).toBe("時間01:05");
      expect(optimal).toBeNull();
    });

    test("盤面に駒を並べること", () => {
      const board = screen.getByRole("group", { name: "箱入り娘盤面" });
      const pieceButtons = within(board).getAllByRole("button");

      expect(pieceButtons).toHaveLength(pieces.length);
    });

    test("待ったボタンで待ったを通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(callbacks.onUndo).toHaveBeenCalledOnce();
    });

    const menuCases = [
      ["盤面を戻す", "onRestart"],
      ["リセット", "onReplay"],
      ["別の問題", "onStartNewProblem"],
      ["問題選択", "onOpenGameHome"],
      ["パズル選択", "onBackToHome"],
    ] as const;

    test.each(menuCases)(
      "メニューの %s で対応する操作を通知すること",
      (itemName, callbackName) => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    test("メニューの 遊び方 で、動かし方と1手の数え方を説明する遊び方を開くこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));

      const dialog = within(screen.getByRole("dialog", { name: "遊び方" }));

      expect(dialog.getByText(/駒を指でなぞると/)).toBeTruthy();
      expect(dialog.getByText(/指を離しても1手/)).toBeTruthy();
    });
  });

  describe("クリアして結果表示へ進んだ場合", () => {
    beforeEach(() => {
      renderPlay("result");
    });

    test("スコアと手数・時間を基準との差つきで表示すること", () => {
      const score = screen.getByText("68点（100点満点）");
      const moveCount = screen.getByText("20手");
      const moveDelta = screen.getByLabelText("最短手数より多い +7");
      const elapsedTime = screen.getByText("01:20");
      const timeDelta = screen.getByLabelText("基準時間より長い +00:22");

      expect(score).toBeTruthy();
      expect(moveCount).toBeTruthy();
      expect(moveDelta).toBeTruthy();
      expect(elapsedTime).toBeTruthy();
      expect(timeDelta).toBeTruthy();
    });

    test("盤面を表示しないこと", () => {
      const board = screen.queryByRole("group", { name: "箱入り娘盤面" });

      expect(board).toBeNull();
    });

    test("スコアの内訳と、最短手数・待った・盤面を戻すの回数、採点基準を開けること", () => {
      fireEvent.click(screen.getByRole("button", { name: "採点内訳" }));

      const efficiency = screen.getByText("50 / 70");
      const speed = screen.getByText("18 / 30");
      const optimal = screen.getByText("最短手数").parentElement;
      const undoCount = screen.getByText("待った").parentElement;
      const restartCount = screen.getByText("盤面を戻す").parentElement;
      const speedCriteria = screen.getByText(
        /基準時間は盤面を読む10秒 \+ 最短13手 × 2\.5秒 \+ よける順を読む6手 × 2\.5秒/,
      );

      expect(efficiency).toBeTruthy();
      expect(speed).toBeTruthy();
      expect(optimal?.textContent).toContain("13手");
      expect(undoCount?.textContent).toContain("2回");
      expect(restartCount?.textContent).toContain("1回");
      expect(speedCriteria).toBeTruthy();
    });
  });
});

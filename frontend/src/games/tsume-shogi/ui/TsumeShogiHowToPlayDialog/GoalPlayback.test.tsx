import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { applyTsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import { listTsumeShogiBoardPieces } from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { goalFigure } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { goalFrames, GOAL_START_HOLD_MS } = _private;

/** 作意をすべて指した、詰んだ局面。 */
const matedPosition = goalFigure.problem.mainLine.reduce(
  applyTsumeShogiMove,
  goalFigure.problem.initialPosition,
);

/** 始まりの盤面から最後の姿までにかかる時間。 */
const playbackMs = goalFrames.reduce((total, { holdMs }) => total + holdMs, 0);

/** ゴールの盤面に描かれている駒のある升の読み上げ名。本番の盤面部品で描くので、本番と同じ名前を持つ。 */
function readGoalPieces(): string[] {
  return within(screen.getByRole("img", { name: "ゴールの盤面" }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "")
    .filter((label) => label.includes("方の"));
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

function renderGoal(): void {
  render(
    <TsumeShogiPieceDefs>
      <GoalPlayback />
    </TsumeShogiPieceDefs>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

describe("goalFrames", () => {
  test("始まりの盤面から始め、本番の session で作意を指して、詰んだ局面で終えること", () => {
    const first = goalFrames[0]?.session;
    const last = goalFrames.at(-1)?.session;

    expect(first?.puzzleState).toBe(goalFigure.problem.initialPosition);
    expect(last?.status).toBe("cleared");
    expect(listTsumeShogiBoardPieces(last!.puzzleState)).toEqual(
      listTsumeShogiBoardPieces(matedPosition),
    );
  });

  test("飛を成るかの選択肢を出した姿を、成った姿の前に見せること", () => {
    const offered = goalFrames.findIndex(
      ({ session }) => session.promotionChoice !== null,
    );

    expect(offered).toBeGreaterThan(0);
    expect(goalFrames[offered + 1]?.session.turns).toHaveLength(1);
  });
});

describe("GoalPlayback", () => {
  describe("開いた場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderGoal();
    });

    test("始まりの盤面を見せ、見せ直すボタンを押せなくすること", () => {
      const pieces = readGoalPieces();

      expect(pieces).toContain("1一 玉方の玉");
      expect(pieces).toContain("5三 攻方の飛車");
      expect(getReplayButton().disabled).toBe(true);
    });

    test("時間が経つと作意を指していき、詰んだ姿で止めること", () => {
      // 詰ませた後、詰みの演出を終えるまで進める。演出の長さは、詰んだ姿を描いてから決まる。
      act(() => {
        vi.advanceTimersByTime(playbackMs);
      });
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const pieces = readGoalPieces();

      expect(pieces).toEqual(
        expect.arrayContaining([
          "2一 玉方の玉",
          "2二 攻方の金",
          "1三 攻方の龍",
        ]),
      );
      expect(getReplayButton().disabled).toBe(false);
    });
  });

  describe("指している途中で盤面を押した場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderGoal();
      act(() => {
        vi.advanceTimersByTime(GOAL_START_HOLD_MS + 10);
      });
    });

    test("残りを飛ばして詰んだ姿を見せ、見せ直すボタンを出すこと", () => {
      fireEvent.click(screen.getByLabelText("詰んだ姿まで飛ばす"));

      expect(readGoalPieces()).toContain("2二 攻方の金");
      expect(getReplayButton().disabled).toBe(false);
    });
  });

  describe("詰んだ姿で見せ直すボタンを押した場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderGoal();
      // 詰ませた後、詰みの演出を終えるまで進める。演出の長さは、詰んだ姿を描いてから決まる。
      act(() => {
        vi.advanceTimersByTime(playbackMs);
      });
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    });

    test("始まりの盤面に戻して見せ直すこと", () => {
      fireEvent.click(getReplayButton());

      expect(readGoalPieces()).toContain("5三 攻方の飛車");
      expect(getReplayButton().disabled).toBe(true);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      renderGoal();
    });

    test("始まりの盤面を短く見せてから、詰んだ姿を動かさずに見せること", () => {
      act(() => {
        vi.advanceTimersByTime(GOAL_START_HOLD_MS);
      });

      expect(readGoalPieces()).toContain("2二 攻方の金");
      expect(getReplayButton().disabled).toBe(false);
    });
  });
});

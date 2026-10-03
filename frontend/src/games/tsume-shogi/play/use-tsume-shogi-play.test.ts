import { act, cleanup, renderHook } from "@testing-library/react";

import { createProblemSeed } from "@/games/problem-seed";
import {
  TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS,
  useTsumeShogiPlay,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
import { formatTsumeShogiMoveUsi } from "@/games/tsume-shogi/puzzle/moves";
import {
  calculateTsumeShogiPlayScore,
  calculateTsumeShogiSpeedFullScoreMs,
} from "@/games/tsume-shogi/score";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useTsumeShogiPlay> };

const difficulty = "2";
const seed = "use-tsume-shogi-play-a";
const pooled = selectTsumeShogiProblemForDifficulty(difficulty, seed);
const fivePly = selectTsumeShogiProblemForDifficulty("3", seed);

/**
 * 作意の攻方の手を盤面と持駒の操作で指し、玉方の応手の間を進める。`plies` を渡すと、作意の初めのその手数までを指す。
 */
function playMainLine(
  result: HookResult,
  problem: TsumeShogiProblem,
  plies = problem.mainLine.length,
): void {
  problem.mainLine.slice(0, plies).forEach((move, index) => {
    if (index % 2 === 1) return;

    if (move.kind === "drop") {
      act(() => result.current.tapHand(move.pieceType));
    } else {
      act(() => result.current.tapSquare(move.from));
    }
    act(() => result.current.tapSquare(move.to));
    if (result.current.promotionChoice) {
      act(() =>
        result.current.choosePromotion(move.kind === "board" && move.promote),
      );
    }
    act(() => vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(createProblemSeed).mockReset();
});

describe("useTsumeShogiPlay", () => {
  describe("難易度だけを渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed).mockReturnValueOnce(seed);
      ({ result } = renderHook(() => useTsumeShogiPlay(difficulty)));
    });

    test("問題集から選んだ問題の作業の量と問題集の中の位置を返すこと", () => {
      const {
        problemIdentity,
        workload,
        poolReference,
        result: playResult,
      } = result.current;

      expect(problemIdentity).toEqual(pooled.identity);
      expect(workload).toEqual(pooled.workload);
      expect(poolReference).toEqual(pooled.poolReference);
      expect(playResult).toBeNull();
    });

    describe("作意どおりに詰ませた場合", () => {
      beforeEach(() => {
        playMainLine(result, pooled.problem);
      });

      test("プレイの事実と作業の量から評価を返すこと", () => {
        const { result: playResult } = result.current;
        const elapsedMs = playResult?.elapsedMs ?? 0;

        expect(playResult).toMatchObject({
          wrongCheckCount: 0,
          workload: pooled.workload,
          speedFullScoreMs: calculateTsumeShogiSpeedFullScoreMs(
            pooled.workload,
          ),
          speedZeroScoreMs:
            calculateTsumeShogiSpeedFullScoreMs(pooled.workload) * 3,
          timeDeltaMs:
            elapsedMs - calculateTsumeShogiSpeedFullScoreMs(pooled.workload),
          score: calculateTsumeShogiPlayScore({
            elapsedMs,
            wrongCheckCount: 0,
            workload: pooled.workload,
          }),
        });
      });
    });
  });

  describe("問題集の問題を指定した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      ({ result } = renderHook(() => useTsumeShogiPlay(difficulty, pooled)));
    });

    test("指定した問題と作業の量と問題集の中の位置で始めること", () => {
      const { problemIdentity, workload, poolReference } = result.current;

      expect(problemIdentity).toEqual(pooled.identity);
      expect(workload).toEqual(pooled.workload);
      expect(poolReference).toEqual(pooled.poolReference);
    });
  });

  describe("2つ目の王手まで指して元に戻した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      ({ result } = renderHook(() => useTsumeShogiPlay("3", fivePly)));
      playMainLine(result, fivePly.problem, 4);
      act(() => result.current.undo());
    });

    test("1つ目の組の手を、指した手ではなく盤面に戻ってきた手として返すこと", () => {
      const { shownMoves, shownMovesRestored } = result.current;

      expect(
        shownMoves.map(({ move }) => formatTsumeShogiMoveUsi(move)),
      ).toEqual(
        fivePly.problem.mainLine.slice(0, 2).map(formatTsumeShogiMoveUsi),
      );
      expect(shownMovesRestored).toBe(true);
    });
  });
});

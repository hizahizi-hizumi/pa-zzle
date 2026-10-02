import { act, cleanup, renderHook } from "@testing-library/react";

import { createProblemSeed } from "@/games/problem-seed";
import {
  TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS,
  useTsumeShogiPlay,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  createTsumeShogiProblemIdentity,
  parseTsumeShogiProblemText,
  type TsumeShogiProblem,
} from "@/games/tsume-shogi/problem/problem";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
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

// 問題集に無い identity の3手詰（生成器の版 1 の `ts-3-5`）。
const unpooled = {
  problem: parseTsumeShogiProblemText({
    sfen: "5s3/6k2/9/5P1+R1/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
    mainLine: ["S*3c", "3b3a", "2d2b"],
  }),
  identity: createTsumeShogiProblemIdentity(3, 5),
};

/** 作意の攻方の手を盤面と持駒の操作で指し、玉方の応手の間を進める。 */
function playMainLine(result: HookResult, problem: TsumeShogiProblem): void {
  problem.mainLine.forEach((move, index) => {
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
        const { sessionResult, result: playResult } = result.current;

        expect(sessionResult).not.toBeNull();
        expect(playResult).toEqual({
          ...sessionResult,
          workload: pooled.workload,
          speedFullScoreMs: calculateTsumeShogiSpeedFullScoreMs(
            pooled.workload,
          ),
          speedZeroScoreMs:
            calculateTsumeShogiSpeedFullScoreMs(pooled.workload) * 3,
          timeDeltaMs:
            sessionResult!.elapsedMs -
            calculateTsumeShogiSpeedFullScoreMs(pooled.workload),
          score: calculateTsumeShogiPlayScore({
            elapsedMs: sessionResult!.elapsedMs,
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
      ({ result } = renderHook(() =>
        useTsumeShogiPlay(difficulty, {
          problem: pooled.problem,
          identity: pooled.identity,
        }),
      ));
    });

    test("問題集から作業の量と問題集の中の位置を引くこと", () => {
      const { problemSource, workload, poolReference } = result.current;

      expect(problemSource).toBe("given");
      expect(workload).toEqual(pooled.workload);
      expect(poolReference).toEqual(pooled.poolReference);
    });
  });

  describe("問題集に無い問題を指定した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      ({ result } = renderHook(() => useTsumeShogiPlay("1", unpooled)));
      playMainLine(result, unpooled.problem);
    });

    test("詰ませても作業の量が無いので評価を返さないこと", () => {
      const {
        status,
        sessionResult,
        workload,
        poolReference,
        result: playResult,
      } = result.current;

      expect(status).toBe("cleared");
      expect(sessionResult).not.toBeNull();
      expect(workload).toBeNull();
      expect(poolReference).toBeNull();
      expect(playResult).toBeNull();
    });
  });
});

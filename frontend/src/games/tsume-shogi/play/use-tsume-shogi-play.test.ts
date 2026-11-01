import { act, cleanup, renderHook } from "@testing-library/react";

import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";
import {
  _private,
  formatTsumeShogiSquareKey,
  TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS,
  type TsumeShogiPlay,
  useTsumeShogiPlay,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import { storeTsumeShogiProblemPool } from "@/games/tsume-shogi/problem/problem-pool";
import problemPoolJson from "@/games/tsume-shogi/problem/problem-pool.json";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
import {
  formatTsumeShogiMoveUsi,
  parseTsumeShogiMoveUsi,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  listTsumeShogiBoardPieces,
} from "@/games/tsume-shogi/puzzle/position";
import {
  calculateTsumeShogiPlayScore,
  calculateTsumeShogiSpeedFullScoreMs,
} from "@/games/tsume-shogi/score";
import type { TsumeShogiSessionTurn } from "@/games/tsume-shogi/session/session";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

// 問題集の本体は画面を開いたときに読み込むので、テストではファイルの内容を先に置いておく。
storeTsumeShogiProblemPool(problemPoolJson);

type HookResult = { current: TsumeShogiPlay };

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

    playAttackerMove(result, move);
    act(() => vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS));
  });
}

/** 攻方の手を盤面と持駒の操作で指す。玉方の応手の間は進めない。 */
function playAttackerMove(result: HookResult, move: TsumeShogiMove): void {
  if (move.kind === "drop") {
    act(() => result.current.selectHandPiece(move.pieceType));
  } else {
    act(() => result.current.selectSquare(move.from));
  }
  act(() => result.current.selectSquare(move.to));
  if (result.current.promotionChoice) {
    act(() =>
      result.current.choosePromotion(move.kind === "board" && move.promote),
    );
  }
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
          speedRule: {
            fullScoreMs: calculateTsumeShogiSpeedFullScoreMs(pooled.workload),
            zeroScoreMs:
              calculateTsumeShogiSpeedFullScoreMs(pooled.workload) * 3,
          },
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

  describe("避ける問題を渡した場合", () => {
    const otherSeed = "use-tsume-shogi-play-b";
    const other = selectTsumeShogiProblemForDifficulty(difficulty, otherSeed);
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(seed)
        .mockReturnValueOnce(otherSeed);
      ({ result } = renderHook(() =>
        useTsumeShogiPlay(
          difficulty,
          undefined,
          createProblemId(pooled.identity),
        ),
      ));
    });

    test("避ける問題を選ばずに選び直した問題で始めること", () => {
      const { problemIdentity } = result.current;

      expect(other.identity).not.toEqual(pooled.identity);
      expect(problemIdentity).toEqual(other.identity);
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

  describe("2つ目の王手まで指して待ったをした場合", () => {
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

  describe("2つ目の王手を指して玉方が応じた場合", () => {
    let result: HookResult;

    beforeEach(() => {
      ({ result } = renderHook(() => useTsumeShogiPlay("3", fivePly)));
      playMainLine(result, fivePly.problem, 4);
    });

    test("前の組の玉方の手の移動先を、棋譜の「同」のために返すこと", () => {
      const { precedingMoveTo } = result.current;

      expect(precedingMoveTo).toEqual(fivePly.problem.mainLine[1]!.to);
    });
  });
});

describe("isDropAmbiguous", () => {
  const { isDropAmbiguous } = _private;
  // 2九に攻方の銀、持駒に銀。2八へは盤上の銀も動ける。
  const position = createTsumeShogiPosition("8k/9/9/9/9/9/9/9/7S1", {
    silver: 1,
  });
  const cases = [
    ["盤上の同じ駒も動ける升へ打つ", "S*2h", true],
    ["盤上の同じ駒が動けない升へ打つ", "S*5e", false],
    ["盤上の駒を動かす", "2i2h", false],
  ] as const;

  test.each(cases)("%s手 %s を %s とすること", (_, usi, expected) => {
    const ambiguous = isDropAmbiguous(position, parseTsumeShogiMoveUsi(usi));

    expect(ambiguous).toBe(expected);
  });
});

describe("listBoardPieceIds", () => {
  const { listBoardPieceIds } = _private;
  // 1一に玉方の玉、2九に攻方の銀、持駒に金。
  const position = createTsumeShogiPosition("8k/9/9/9/9/9/9/9/7S1", {
    gold: 1,
  });
  const initialIds = new Map(
    listTsumeShogiBoardPieces(position).map(({ square }, index) => [
      formatTsumeShogiSquareKey(square),
      `piece-${index}`,
    ]),
  );
  function createTurn(
    attackerUsi: string,
    defenderUsi: string,
  ): TsumeShogiSessionTurn {
    return {
      line: "main",
      attackerMove: parseTsumeShogiMoveUsi(attackerUsi),
      positionAfterAttack: position,
      defenderMove: parseTsumeShogiMoveUsi(defenderUsi),
      positionAfterDefense: position,
      canContinue: true,
    };
  }
  const turns = [createTurn("2i2h", "1a2a"), createTurn("G*2b", "2a1a")];

  describe("どの応手も盤面に指した場合", () => {
    test("動いた駒は移動先でも同じ識別を持ち、打った駒には新しい識別を付けること", () => {
      const ids = listBoardPieceIds(position, turns, false);

      expect(Object.fromEntries(ids)).toEqual({
        "2-8": initialIds.get("2-9"),
        "1-1": initialIds.get("1-1"),
        "2-2": "drop-0",
      });
    });
  });

  describe("最後の応手を待っている場合", () => {
    test("まだ指していない応手で駒を動かさないこと", () => {
      const ids = listBoardPieceIds(position, turns, true);

      expect(Object.fromEntries(ids)).toEqual({
        "2-8": initialIds.get("2-9"),
        "2-1": initialIds.get("1-1"),
        "2-2": "drop-0",
      });
    });
  });

  describe("盤面を操作した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      ({ result } = renderHook(() => useTsumeShogiPlay(difficulty, pooled)));
    });

    test("操作する前は操作を知らせないこと", () => {
      const { operation } = result.current;

      expect(operation).toBeNull();
    });

    describe("作意の初手の王手を指した場合", () => {
      beforeEach(() => {
        playAttackerMove(result, pooled.problem.mainLine[0]!);
      });

      test("指したことを知らせること", () => {
        const { operation } = result.current;

        expect(operation?.type).toBe("moved");
      });

      test("玉方の応手を盤面に指すと、応じたことを別の id で知らせること", () => {
        const movedId = result.current.operation?.id;

        act(() => vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS));

        expect(result.current.operation?.type).toBe("replied");
        expect(result.current.operation?.id).not.toBe(movedId);
      });

      describe("玉方が応じた場合", () => {
        beforeEach(() => {
          act(() =>
            vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS),
          );
        });

        test("待ったで操作の知らせを消すこと", () => {
          act(() => result.current.undo());

          expect(result.current.operation).toBeNull();
        });

        describe("待ったをした場合", () => {
          let repliedId: number | undefined;

          beforeEach(() => {
            repliedId = result.current.operation?.id;
            act(() => result.current.undo());
          });

          test("同じ手を指し直すと、別の id で知らせること", () => {
            playAttackerMove(result, pooled.problem.mainLine[0]!);

            expect(result.current.operation?.type).toBe("moved");
            expect(result.current.operation?.id).not.toBe(repliedId);
          });
        });
      });
    });
  });
});

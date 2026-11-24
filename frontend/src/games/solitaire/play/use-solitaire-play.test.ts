import { act, cleanup, renderHook } from "@testing-library/react";

import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";
import { useSolitairePlay } from "@/games/solitaire/play/use-solitaire-play";
import {
  listSolitairePoolEntries,
  restoreSolitairePoolEntry,
} from "@/games/solitaire/problem/problem-pool";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import {
  applySolitaireMove,
  _private as rulesPrivate,
  type SolitaireMove,
} from "@/games/solitaire/puzzle/rules";
import {
  createSolitaireInitialState,
  findSolitaireRunStart,
  isSolitaireCleared,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

const { listSolitaireMoves } = rulesPrivate;

/** 状態の知らせの判定の答えを、テストごとに決められるようにする。`null` なら本当の判定を使う。 */
const progressOverride = vi.hoisted(() => ({
  value: null as "unreachable" | null,
}));

vi.mock(
  "@/games/solitaire/puzzle/foundation-progress",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/games/solitaire/puzzle/foundation-progress")
      >();
    return {
      ...actual,
      findSolitaireFoundationProgress(
        ...args: Parameters<typeof actual.findSolitaireFoundationProgress>
      ) {
        return (
          progressOverride.value ??
          actual.findSolitaireFoundationProgress(...args)
        );
      },
    };
  },
);

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

/** 各レベルの問題集は1問なので、seed で選ぶ場合は、`otherSeed` だけレベル2 の問題を選ぶ問題集にする。 */
const { initialSeed, otherSeed } = vi.hoisted(() => ({
  initialSeed: "use-solitaire-play-a",
  otherSeed: "use-solitaire-play-b",
}));

vi.mock("@/games/solitaire/problem-selection", async () => {
  const { listSolitairePoolEntries, restoreSolitairePoolEntry } = await import(
    "@/games/solitaire/problem/problem-pool"
  );
  return {
    selectSolitaireProblemForDifficulty(_difficulty: string, seed: string) {
      return restoreSolitairePoolEntry(
        listSolitairePoolEntries(seed === otherSeed ? "2" : "1")[0]!,
      );
    },
  };
});

afterEach(() => {
  cleanup();
  progressOverride.value = null;
  vi.mocked(createProblemSeed).mockReset();
});

type HookResult = ReturnType<typeof useSolitairePlay>;

const column = (columnIndex: number): SolitairePile => ({
  pile: "column",
  columnIndex,
});

/** 組札へ置く手は、どのマークの組札を押しても札のマークの組札へ置くので、♠ の組札を押す。 */
const anyFoundation: SolitairePile = { pile: "foundation", suit: "spades" };

function toPresses(move: SolitaireMove): SolitairePile[] {
  if (move.kind !== "transfer") {
    return [{ pile: "stock" }];
  }
  return [
    move.source,
    move.destination.pile === "foundation" ? anyFoundation : move.destination,
  ];
}

/**
 * 組札へ送る手、札をめくり出す列の移動、捨て札から列へ、山札を押す手、列を空ける移動、並びの途中からの移動、組札から戻す手の順に試し、
 * 同じ局面へは戻らずに解く。素朴な手で解けるレベル1 の配り方は、戻らずに1本道で解ける。
 */
function findSolution(start: SolitaireState): SolitairePile[] {
  const seen = new Set<string>();
  const presses: SolitairePile[][] = [];
  function priority(state: SolitaireState, move: SolitaireMove): number {
    if (move.kind !== "transfer") return 3;
    if (move.source.pile === "foundation") return 6;
    if (move.destination.pile === "foundation") return 0;
    if (move.source.pile === "waste") return 2;
    const column = state.columns[move.source.columnIndex] ?? [];
    if (move.cardCount < column.length - findSolitaireRunStart(column)) {
      return 5;
    }
    return column.length > move.cardCount ? 1 : 4;
  }
  function search(state: SolitaireState): boolean {
    if (isSolitaireCleared(state)) return true;
    const key = JSON.stringify(state);
    if (seen.has(key)) return false;
    seen.add(key);
    const moves = listSolitaireMoves(state).sort(
      (left, right) => priority(state, left) - priority(state, right),
    );
    return moves.some((move) => {
      presses.push(toPresses(move));
      if (search(applySolitaireMove(state, move)!)) return true;
      presses.pop();
      return false;
    });
  }
  search(start);
  return presses.flat();
}

const pooled = restoreSolitairePoolEntry(listSolitairePoolEntries("1")[0]!);
const solution = findSolution(
  createSolitaireInitialState(pooled.problem.columns, pooled.problem.stock),
);

/** 判定は列と組札の配列ごとに覚えるので、判定の答えを変えるテストは、配列を作り直した問題で始める。 */
function renderPlay(problem = pooled) {
  return renderHook(() => useSolitairePlay("1", problem));
}

function selectPiles(
  result: { current: HookResult },
  piles: readonly SolitairePile[],
) {
  for (const pile of piles) {
    act(() => result.current.selectPile(pile));
  }
}

describe("useSolitairePlay", () => {
  // L1 の配り方の列4 は K♣ 10♥ J♦ J♠、列3 は 7♥ 4♦ A♦。
  describe("始めた盤面の場合", () => {
    let result: { current: HookResult };

    beforeEach(() => {
      ({ result } = renderPlay());
    });

    test("知らせを出さず、待ったも盤面を戻すもできないこと", () => {
      const { isStuck, canUndo, canRestart, selectedSource } = result.current;

      expect({ isStuck, canUndo, canRestart, selectedSource }).toEqual({
        isStuck: false,
        canUndo: false,
        canRestart: false,
        selectedSource: null,
      });
    });

    test("札のある列を押すと置き元に選ぶこと", () => {
      selectPiles(result, [column(2)]);

      expect(result.current.selectedSource).toEqual(column(2));
      expect(result.current.operation).toMatchObject({
        type: "source-selected",
      });
    });

    test("選んだ列をもう一度押すと選ぶのをやめること", () => {
      selectPiles(result, [column(2), column(2)]);

      expect(result.current.selectedSource).toBeNull();
      expect(result.current.operation).toMatchObject({
        type: "source-deselected",
      });
    });

    test("置けない所を押すと盤面を変えずに、置けないことを知らせること", () => {
      const before = result.current.state;

      selectPiles(result, [column(2), column(3)]);

      expect(result.current.state).toBe(before);
      expect(result.current.selectedSource).toEqual(column(2));
      expect(result.current.operation).toMatchObject({
        type: "invalid",
        pile: column(3),
      });
    });

    test("置き元から組札を押すと札を組札へ置き、選んだ置き元を消すこと", () => {
      selectPiles(result, [column(2), anyFoundation]);

      expect(result.current.state.foundations.diamonds).toBe(1);
      expect(result.current.selectedSource).toBeNull();
      expect(result.current.moveCount).toBe(1);
      expect(result.current.operation).toMatchObject({
        type: "moved",
        isClearingMove: false,
      });
    });

    test("山札を押すと1枚めくって捨て札に置くこと", () => {
      selectPiles(result, [{ pile: "stock" }]);

      expect(result.current.state.waste).toHaveLength(1);
      expect(result.current.state.stock).toHaveLength(23);
    });
  });

  describe("手を打った後の場合", () => {
    let result: { current: HookResult };
    let initialState: SolitaireState;

    beforeEach(() => {
      ({ result } = renderPlay());
      initialState = result.current.state;
      selectPiles(result, [column(2), anyFoundation, { pile: "stock" }]);
    });

    test("待ったで直前の手を1つ戻し、待ったの回数を数えること", () => {
      act(() => result.current.undo());

      expect(result.current.state.waste).toHaveLength(0);
      expect(result.current.state.foundations.diamonds).toBe(1);
      expect(result.current.undoCount).toBe(1);
    });

    test("盤面を戻すと配った直後の盤面に戻ること", () => {
      act(() => result.current.restart());

      expect(result.current.state).toEqual(initialState);
      expect(result.current.canRestart).toBe(false);
    });
  });

  describe("解き切った場合", () => {
    let result: { current: HookResult };

    beforeEach(() => {
      ({ result } = renderPlay());
      selectPiles(result, solution);
    });

    test("クリアして完成演出の段へ進み、取り消した手の無い結果を作ること", () => {
      const { status, progress, isStuck, result: playResult } = result.current;

      expect({ status, progress, isStuck }).toEqual({
        status: "cleared",
        progress: "clearing",
        isStuck: false,
      });
      expect(playResult).toMatchObject({
        retractedMoveCount: 0,
        score: { breakdown: { stability: 60 } },
      });
    });

    test("クリア演出の完了で結果へ進むこと", () => {
      act(() => result.current.completeClearAnimation());

      expect(result.current.progress).toBe("result");
    });

    test("リセットで同じ問題を配った直後の盤面から始め直すこと", () => {
      act(() => result.current.replay());
      const { problemIdentity, status, state, moveCount } = result.current;

      expect({
        problemId: createProblemId(problemIdentity),
        status,
        state,
        moveCount,
      }).toEqual({
        problemId: createProblemId(pooled.identity),
        status: "playing",
        state: createSolitaireInitialState(
          pooled.problem.columns,
          pooled.problem.stock,
        ),
        moveCount: 0,
      });
    });
  });

  describe("seed で問題を選んで始めた場合", () => {
    const other = restoreSolitairePoolEntry(listSolitairePoolEntries("2")[0]!);
    let result: { current: HookResult };

    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(initialSeed)
        .mockReturnValue(otherSeed);
      ({ result } = renderHook(() => useSolitairePlay("1")));
    });

    test("seed で選んだ問題を、配った直後の盤面で始めること", () => {
      const { problemIdentity, state, progress } = result.current;

      expect({ problemIdentity, state, progress }).toEqual({
        problemIdentity: pooled.identity,
        state: createSolitaireInitialState(
          pooled.problem.columns,
          pooled.problem.stock,
        ),
        progress: "playing",
      });
    });

    describe("別の問題を始めた場合", () => {
      beforeEach(() => {
        selectPiles(result, [column(2), anyFoundation]);
        act(() => result.current.startNewProblem());
      });

      test("今の問題を避けて選んだ問題を、配った直後の盤面で始めること", () => {
        const { problemIdentity, state, moveCount } = result.current;

        expect({ problemIdentity, state, moveCount }).toEqual({
          problemIdentity: other.identity,
          state: createSolitaireInitialState(
            other.problem.columns,
            other.problem.stock,
          ),
          moveCount: 0,
        });
      });
    });
  });

  describe("どの手順でも組札を増やせない盤面の場合", () => {
    let result: { current: HookResult };

    beforeEach(() => {
      progressOverride.value = "unreachable";
      ({ result } = renderPlay(
        restoreSolitairePoolEntry(listSolitairePoolEntries("1")[0]!),
      ));
    });

    test("プレイ中に知らせを出すこと", () => {
      const { isStuck } = result.current;

      expect(isStuck).toBe(true);
    });
  });
});

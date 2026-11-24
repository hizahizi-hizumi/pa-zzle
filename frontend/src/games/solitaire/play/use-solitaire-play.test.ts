import { act, cleanup, renderHook } from "@testing-library/react";

import { useSolitairePlay } from "@/games/solitaire/play/use-solitaire-play";
import {
  listSolitairePoolEntries,
  restoreSolitairePoolEntry,
} from "@/games/solitaire/problem/problem-pool";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import {
  applySolitaireMove,
  listSolitaireMoves,
  type SolitaireMove,
} from "@/games/solitaire/puzzle/rules";
import {
  createSolitaireInitialState,
  findSolitaireRunStart,
  isSolitaireCleared,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

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

afterEach(() => {
  cleanup();
  progressOverride.value = null;
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

function press(
  result: { current: HookResult },
  piles: readonly SolitairePile[],
) {
  for (const pile of piles) {
    act(() => result.current.pressPile(pile));
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
      press(result, [column(2)]);

      expect(result.current.selectedSource).toEqual(column(2));
      expect(result.current.operation).toMatchObject({
        type: "source-selected",
      });
    });

    test("選んだ列をもう一度押すと選ぶのをやめること", () => {
      press(result, [column(2), column(2)]);

      expect(result.current.selectedSource).toBeNull();
      expect(result.current.operation).toMatchObject({
        type: "source-deselected",
      });
    });

    test("置けない所を押すと盤面を変えずに、置けないことを知らせること", () => {
      const before = result.current.state;

      press(result, [column(2), column(3)]);

      expect(result.current.state).toBe(before);
      expect(result.current.selectedSource).toEqual(column(2));
      expect(result.current.operation).toMatchObject({
        type: "invalid",
        pile: column(3),
      });
    });

    test("置き元から組札を押すと札を組札へ置き、選んだ置き元を消すこと", () => {
      press(result, [column(2), anyFoundation]);

      expect(result.current.state.foundations.diamonds).toBe(1);
      expect(result.current.selectedSource).toBeNull();
      expect(result.current.moveCount).toBe(1);
      expect(result.current.operation).toMatchObject({
        type: "moved",
        isClearingMove: false,
      });
    });

    test("山札を押すと1枚めくって捨て札に置くこと", () => {
      press(result, [{ pile: "stock" }]);

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
      press(result, [column(2), anyFoundation, { pile: "stock" }]);
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
    });

    test("クリア演出の後に結果へ進み、取り消した手の無い結果を作ること", () => {
      press(result, solution);
      const clearing = result.current.progress;
      act(() => result.current.completeClearAnimation());

      expect(clearing).toBe("clearing");
      expect(result.current.progress).toBe("result");
      expect(result.current.isStuck).toBe(false);
      expect(result.current.result).toMatchObject({
        retractedMoveCount: 0,
        score: { breakdown: { stability: 60 } },
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

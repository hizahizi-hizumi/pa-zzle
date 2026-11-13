import {
  getHakoiriMusumeClassicCellPosition,
  HAKOIRI_MUSUME_CLASSIC_CELL_COUNT,
  HAKOIRI_MUSUME_CLASSIC_COLUMNS,
  HAKOIRI_MUSUME_CLASSIC_ROWS,
  hakoiriMusumeClassicLayout,
  listHakoiriMusumeClassicPieceCells,
  parseHakoiriMusumeClassicBoard,
} from "@/games/hakoiri-musume/puzzle/classic-board";
import { parseHakoiriMusumeArrangement } from "@/games/hakoiri-musume/puzzle/notation";
import {
  type HakoiriMusumeDirection,
  hakoiriMusumeDirections,
  hakoiriMusumeStepByDirection,
  isHakoiriMusumeCleared,
  moveHakoiriMusumePiece,
  _private as rules,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  createHakoiriMusumeInitialState,
  type HakoiriMusumeState,
} from "@/games/hakoiri-musume/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

const layout = hakoiriMusumeClassicLayout;

function stateOf(text: string): HakoiriMusumeState {
  return createHakoiriMusumeInitialState(parseHakoiriMusumeClassicBoard(text)!);
}

/** 易しい例（最短13手）と横刀立馬（最短81手）。 */
const easyExample = stateOf("vAAvwAAwv..vwhiws..s");
const yokogatanaExample = stateOf("vAAvwAAwvhivwssws..s");

/** 盤面のマスごとに、覆っている駒の番号。空きは -1。 */
function paintPieceIndices(state: HakoiriMusumeState): number[] {
  const painted = new Array<number>(HAKOIRI_MUSUME_CLASSIC_CELL_COUNT).fill(-1);
  state.pieces.forEach((piece, index) => {
    for (const cell of listHakoiriMusumeClassicPieceCells(piece)) {
      painted[cell] = index;
    }
  });
  return painted;
}

/** 駒の各マスを1マスずらした先が、どれも箱の中で、空きかその駒自身のマスか。 */
function canStepByBruteForce(
  state: HakoiriMusumeState,
  pieceIndex: number,
  direction: HakoiriMusumeDirection,
): boolean {
  const painted = paintPieceIndices(state);
  const step = hakoiriMusumeStepByDirection[direction];
  return listHakoiriMusumeClassicPieceCells(state.pieces[pieceIndex]!).every(
    (cell) => {
      const { row, column } = getHakoiriMusumeClassicCellPosition(cell);
      const nextRow = row + step.row;
      const nextColumn = column + step.column;
      if (
        nextRow < 0 ||
        nextColumn < 0 ||
        nextRow >= HAKOIRI_MUSUME_CLASSIC_ROWS ||
        nextColumn >= HAKOIRI_MUSUME_CLASSIC_COLUMNS
      ) {
        return false;
      }
      const occupant =
        painted[nextRow * HAKOIRI_MUSUME_CLASSIC_COLUMNS + nextColumn];
      return occupant === -1 || occupant === pieceIndex;
    },
  );
}

/** 合法な1マスの移動を無作為に重ねて、途中の盤面を集める。 */
function collectRandomStates(
  start: HakoiriMusumeState,
  seed: string,
  count: number,
): HakoiriMusumeState[] {
  const random = createProblemSeededRandom(seed);
  const states: HakoiriMusumeState[] = [];
  let state = start;
  while (states.length < count) {
    const candidates = state.pieces.flatMap((_, pieceIndex) =>
      hakoiriMusumeDirections.flatMap((direction) => {
        const next = moveHakoiriMusumePiece(
          layout,
          state,
          pieceIndex,
          direction,
        );
        return next ? [next] : [];
      }),
    );
    state = candidates[Math.floor(random() * candidates.length)]!;
    states.push(state);
  }
  return states;
}

describe("moveHakoiriMusumePiece", () => {
  describe("無作為にたどった途中の盤面の場合", () => {
    const states = [
      ...collectRandomStates(easyExample, "hakoiri-rules-easy", 300),
      ...collectRandomStates(yokogatanaExample, "hakoiri-rules-yoko", 300),
    ];
    const cases = states.flatMap((state) =>
      state.pieces.flatMap((_, pieceIndex) =>
        hakoiriMusumeDirections.map(
          (direction) => [state, pieceIndex, direction] as const,
        ),
      ),
    );

    test("動かせるかが、駒の各マスをずらした先を1マスずつ調べた結果と一致すること", () => {
      const mismatches = cases.filter(
        ([state, pieceIndex, direction]) =>
          (moveHakoiriMusumePiece(layout, state, pieceIndex, direction) !==
            null) !==
          canStepByBruteForce(state, pieceIndex, direction),
      );

      expect(mismatches).toEqual([]);
    });

    test("動かした駒だけが1マスずれ、ほかの駒は同じ値のまま残ること", () => {
      const violations = cases.filter(([state, pieceIndex, direction]) => {
        const next = moveHakoiriMusumePiece(
          layout,
          state,
          pieceIndex,
          direction,
        );
        if (!next) {
          return false;
        }
        const step = hakoiriMusumeStepByDirection[direction];
        const shift = step.row * HAKOIRI_MUSUME_CLASSIC_COLUMNS + step.column;
        return next.pieces.some((piece, index) =>
          index === pieceIndex
            ? piece.cell !== state.pieces[index]!.cell + shift ||
              piece.kind !== state.pieces[index]!.kind
            : piece !== state.pieces[index],
        );
      });

      expect(violations).toEqual([]);
    });
  });

  describe("易しい例の始めの盤面の場合", () => {
    const blockedCases = [
      ["箱の上の端にある縦長を上へ", 0, "up"],
      ["箱の左の端にある縦長を左へ", 0, "left"],
      ["娘を縦長のある右へ", 1, "right"],
      ["箱の上の端にある娘を上へ", 1, "up"],
    ] as const;

    test.each(blockedCases)(
      "動けない向きには動かないこと: %s",
      (_, pieceIndex, direction) => {
        const next = moveHakoiriMusumePiece(
          layout,
          easyExample,
          pieceIndex,
          direction,
        );

        expect(next).toBeNull();
      },
    );

    test("上の2マスが空いている横長は上へ動くこと", () => {
      const next = moveHakoiriMusumePiece(layout, easyExample, 5, "up");

      expect(next?.pieces[5]).toEqual({
        kind: "horizontal",
        cell: 9,
        target: null,
      });
    });
  });
});

describe("listHakoiriMusumePieceDestinations", () => {
  describe("易しい例の始めの盤面の場合", () => {
    test("左下の小駒は空いたマスを曲がって進める所まで行けること", () => {
      const destinations = rules.listHakoiriMusumePieceDestinations(
        layout,
        easyExample,
        6,
      );

      expect(destinations).toEqual([17, 18]);
    });

    test("四方をふさがれた駒には行き先が無いこと", () => {
      const destinations = rules.listHakoiriMusumePieceDestinations(
        layout,
        easyExample,
        0,
      );

      expect(destinations).toEqual([]);
    });

    test("横長は上下の空いた段へ行けること", () => {
      const destinations = rules.listHakoiriMusumePieceDestinations(
        layout,
        easyExample,
        5,
      );

      expect(destinations).toEqual([9, 17]);
    });
  });

  describe("小駒が曲がって行ける盤面の場合", () => {
    // s.hi
    // v.AA
    // w.AA
    // vhiv
    // w..w
    const state = stateOf("s.hiv.AAw.AAvhivw..w");

    test("右へ1マス進んでから下へ曲がった先まで、近い順に返すこと", () => {
      const destinations = rules.listHakoiriMusumePieceDestinations(
        layout,
        state,
        0,
      );

      expect(destinations).toEqual([1, 5, 9]);
    });
  });
});

describe("isHakoiriMusumeCleared", () => {
  const cases = [
    ["娘の左上が下から2段目・左から2列目", "v..vwssw.hi.vAAvwAAw", true],
    ["娘が出口の前の右にずれている", "v..vwssw.hi.vsAAw.AA", false],
    ["娘が出口の前の1段上", "v..vwssw.AAv.AAwhis.", false],
    ["娘が始めの位置", "vAAvwAAwv..vwhiws..s", false],
  ] as const;

  test.each(cases)("娘の位置で判定すること: %s", (_, text, expected) => {
    const cleared = isHakoiriMusumeCleared(layout, stateOf(text));

    expect(cleared).toBe(expected);
  });
});

/** 盤の作りの書き方（`formatHakoiriMusumeArrangement`）から、盤の作りと始めの盤面を読む。 */
function arrangementOf(text: string) {
  const { layout: arrangedLayout, pieces } =
    parseHakoiriMusumeArrangement(text)!;
  return {
    layout: arrangedLayout,
    state: createHakoiriMusumeInitialState(pieces),
  };
}

describe("壁とL字のある盤の場合", () => {
  // # a . .
  // a a . .
  // . . A A
  // . # A A
  const board = arrangementOf("4x4;#a../aa../..AA/.#AA;bottom2-3@2.2");

  test("L字は、外接矩形の空いたマスに壁があっても、占めるマスが空いていれば動けること", () => {
    const next = moveHakoiriMusumePiece(board.layout, board.state, 0, "right");

    expect(next?.pieces[0]?.cell).toBe(1);
  });

  test("L字は、占めるマスの行き先に壁があれば動けないこと", () => {
    const lowered = moveHakoiriMusumePiece(
      board.layout,
      board.state,
      0,
      "down",
    )!;

    const next = moveHakoiriMusumePiece(board.layout, lowered, 0, "down");

    expect(next).toBeNull();
  });

  test("駒は壁のマスへ動けないこと", () => {
    const next = moveHakoiriMusumePiece(board.layout, board.state, 1, "left");

    expect(next).toBeNull();
  });

  test("L字は空いたマスを曲がってたどれる所まで1手で行けること", () => {
    const destinations = rules.listHakoiriMusumePieceDestinations(
      board.layout,
      board.state,
      0,
    );

    expect(destinations).toEqual([1, 4, 2]);
  });
});

describe("目標が2つの盤の場合", () => {
  const goals = "bottom1-2@2.1;top0-1@0.0";
  const cases = [
    ["両方の目標が行き先にある", "4x4;BB../..../.AA./.AA.", true],
    ["1つ目の目標だけが行き先にある", "4x4;..../BB../.AA./.AA.", false],
    ["2つ目の目標だけが行き先にある", "4x4;BB../.AA./.AA./....", false],
  ] as const;

  test.each(cases)(
    "目標がどれも自分の行き先に着いたときだけクリアにすること: %s",
    (_, grid, expected) => {
      const { layout: twoGoals, state } = arrangementOf(`${grid};${goals}`);

      const cleared = isHakoiriMusumeCleared(twoGoals, state);

      expect(cleared).toBe(expected);
    },
  );
});

describe("行き先の置き場所が2つ以上ある盤の場合", () => {
  const cases = [
    ["1つ目の置き場所", "5x4;...../...../.AA../.AA..", true],
    ["2つ目の置き場所", "5x4;...../...../..AA./..AA.", true],
    ["どの置き場所でもない", "5x4;...../.AA../.AA../.....", false],
  ] as const;

  test.each(cases)(
    "目標の駒がどれかの置き場所に着けばクリアにすること: %s",
    (_, grid, expected) => {
      const { layout: wideExit, state } = arrangementOf(
        `${grid};bottom1-3@2.1,2.2`,
      );

      const cleared = isHakoiriMusumeCleared(wideExit, state);

      expect(cleared).toBe(expected);
    },
  );
});

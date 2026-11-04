import {
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
  listHakoiriMusumePieceCells,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  type HakoiriMusumeDirection,
  hakoiriMusumeDirections,
  hakoiriMusumeStepByDirection,
  isHakoiriMusumeCleared,
  listHakoiriMusumePieceDestinations,
  moveHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  createHakoiriMusumeInitialState,
  type HakoiriMusumeState,
} from "@/games/hakoiri-musume/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

function stateOf(text: string): HakoiriMusumeState {
  return createHakoiriMusumeInitialState(parseHakoiriMusumeBoard(text)!);
}

/** 合意の易しい例（最短13手）と横刀立馬（最短81手）。 */
const easyExample = stateOf("vAAvwAAwv..vwhiws..s");
const yokogatanaExample = stateOf("vAAvwAAwvhivwssws..s");

/** 盤面のマスごとに、覆っている駒の番号。空きは -1。 */
function paintPieceIndices(state: HakoiriMusumeState): number[] {
  const painted = new Array<number>(HAKOIRI_MUSUME_CELL_COUNT).fill(-1);
  state.pieces.forEach((piece, index) => {
    for (const cell of listHakoiriMusumePieceCells(piece)) {
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
  return listHakoiriMusumePieceCells(state.pieces[pieceIndex]!).every(
    (cell) => {
      const { row, column } = getHakoiriMusumeCellPosition(cell);
      const nextRow = row + step.row;
      const nextColumn = column + step.column;
      if (
        nextRow < 0 ||
        nextColumn < 0 ||
        nextRow >= HAKOIRI_MUSUME_ROWS ||
        nextColumn >= HAKOIRI_MUSUME_COLUMNS
      ) {
        return false;
      }
      const occupant = painted[nextRow * HAKOIRI_MUSUME_COLUMNS + nextColumn];
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
        const next = moveHakoiriMusumePiece(state, pieceIndex, direction);
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
          (moveHakoiriMusumePiece(state, pieceIndex, direction) !== null) !==
          canStepByBruteForce(state, pieceIndex, direction),
      );

      expect(mismatches).toEqual([]);
    });

    test("動かした駒だけが1マスずれ、ほかの駒は同じ値のまま残ること", () => {
      const violations = cases.filter(([state, pieceIndex, direction]) => {
        const next = moveHakoiriMusumePiece(state, pieceIndex, direction);
        if (!next) {
          return false;
        }
        const step = hakoiriMusumeStepByDirection[direction];
        const shift = step.row * HAKOIRI_MUSUME_COLUMNS + step.column;
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
        const next = moveHakoiriMusumePiece(easyExample, pieceIndex, direction);

        expect(next).toBeNull();
      },
    );

    test("上の2マスが空いている横長は上へ動くこと", () => {
      const next = moveHakoiriMusumePiece(easyExample, 5, "up");

      expect(next?.pieces[5]).toEqual({ kind: "horizontal", cell: 9 });
    });
  });
});

describe("listHakoiriMusumePieceDestinations", () => {
  describe("易しい例の始めの盤面の場合", () => {
    test("左下の小駒は空いたマスを曲がって進める所まで行けること", () => {
      const destinations = listHakoiriMusumePieceDestinations(easyExample, 6);

      expect(destinations).toEqual([17, 18]);
    });

    test("四方をふさがれた駒には行き先が無いこと", () => {
      const destinations = listHakoiriMusumePieceDestinations(easyExample, 0);

      expect(destinations).toEqual([]);
    });

    test("横長は上下の空いた段へ行けること", () => {
      const destinations = listHakoiriMusumePieceDestinations(easyExample, 5);

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
      const destinations = listHakoiriMusumePieceDestinations(state, 0);

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
    const cleared = isHakoiriMusumeCleared(stateOf(text));

    expect(cleared).toBe(expected);
  });
});

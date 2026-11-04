import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { findHakoiriMusumePoolEntryByProblemId } from "@/games/hakoiri-musume/problem/problem-pool";
import {
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
  type HakoiriMusumePiece,
  type HakoiriMusumePieceKind,
  listHakoiriMusumePieceCells,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";

/**
 * 始めたときの盤面を見れば分かる、問題の特徴。
 * - `horizontalCount`: 横長の駒の数。
 * - `smallCount`: 小駒の数。
 * - `emptyGroupCount`: 空きマスのまとまりの数。上下左右でつながった空きを1か所と数える。空きが1か所にまとまっていれば
 *   大きな駒を動かしやすく、ばらけていれば小さな駒で空きを寄せる手から始まる。
 */
export type HakoiriMusumeProblemFeatures = {
  horizontalCount: number;
  smallCount: number;
  emptyGroupCount: number;
};

/** 空きマスのまとまりの数。上下左右でつながった空きを1つと数える。 */
function countEmptyGroups(pieces: readonly HakoiriMusumePiece[]): number {
  const occupied = new Set(pieces.flatMap(listHakoiriMusumePieceCells));
  const seen = new Set<number>();
  let groups = 0;
  for (let cell = 0; cell < HAKOIRI_MUSUME_CELL_COUNT; cell += 1) {
    if (occupied.has(cell) || seen.has(cell)) {
      continue;
    }
    groups += 1;
    const stack = [cell];
    seen.add(cell);
    while (stack.length > 0) {
      const { row, column } = getHakoiriMusumeCellPosition(stack.pop()!);
      for (const [nextRow, nextColumn] of [
        [row - 1, column],
        [row + 1, column],
        [row, column - 1],
        [row, column + 1],
      ] as const) {
        if (
          nextRow < 0 ||
          nextRow >= HAKOIRI_MUSUME_ROWS ||
          nextColumn < 0 ||
          nextColumn >= HAKOIRI_MUSUME_COLUMNS
        ) {
          continue;
        }
        const next = getHakoiriMusumeCell({ row: nextRow, column: nextColumn });
        if (!occupied.has(next) && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
  }
  return groups;
}

/** 始めたときの盤面から問題の特徴を求める。 */
export function measureHakoiriMusumeProblemFeatures(
  pieces: readonly HakoiriMusumePiece[],
): HakoiriMusumeProblemFeatures {
  function countKind(kind: HakoiriMusumePieceKind): number {
    return pieces.filter((piece) => piece.kind === kind).length;
  }
  return {
    horizontalCount: countKind("horizontal"),
    smallCount: countKind("small"),
    emptyGroupCount: countEmptyGroups(pieces),
  };
}

/** 難易度の問題集の1問の特徴を、問題集の盤面の20文字から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolProblemFeatures(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemFeatures | null {
  const entry = findHakoiriMusumePoolEntryByProblemId(difficulty, problemId);
  const pieces = entry ? parseHakoiriMusumeBoard(entry[0]) : null;
  return pieces ? measureHakoiriMusumeProblemFeatures(pieces) : null;
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。最短手数は解かないと分からないので軸にしない。 */
export const hakoiriMusumeProblemFeatureAxes = [
  {
    id: "horizontal-count",
    getValue({ horizontalCount }) {
      return createCountFeatureValue(horizontalCount);
    },
  },
  {
    id: "small-count",
    getValue({ smallCount }) {
      return createCountFeatureValue(smallCount);
    },
  },
  {
    id: "empty-group-count",
    getValue({ emptyGroupCount }) {
      return createCountFeatureValue(emptyGroupCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<HakoiriMusumeProblemFeatures>[];

export type HakoiriMusumeProblemFeatureAxisId =
  (typeof hakoiriMusumeProblemFeatureAxes)[number]["id"];

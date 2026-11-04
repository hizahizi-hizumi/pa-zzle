import { readFileSync } from "node:fs";
import { createProblemId } from "@/games/problem-id";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import {
  fromReflectionCellCode,
  type ReflectionCellCode,
} from "@/games/reflection/problem/generation/cell-code";
import {
  createReflectionProblemIdentity,
  isReflectionBoardSize,
} from "@/games/reflection/problem/problem";
import type {
  ReflectionProblemPool,
  ReflectionProblemPoolEntry,
} from "@/games/reflection/problem/problem-pool";
import {
  countReflectionBoardPieces,
  getReflectionInventoryPieceCount,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { reflectionPieceLabels } from "@/games/reflection/ui/piece-label";

/** 解の1ピースを、プレイ画面で押す相手のアクセシブルな名前で表したもの。 */
export type ReflectionSolutionPlacement = {
  stockPieceName: string;
  emptyCellName: string;
};

// problem-pool.ts は JSON を import 属性なしで読み込み、Node の ES モジュールとしては読めないので、問題集はファイルとして読む。
const problemPool: ReflectionProblemPool = JSON.parse(
  readFileSync(
    new URL(
      "../src/games/reflection/problem/problem-pool.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function decodeSolution(encodedSolution: string): ReflectionBoard {
  return {
    size: Math.sqrt(encodedSolution.length),
    cells: Array.from(encodedSolution, (digit) =>
      fromReflectionCellCode(Number(digit) as ReflectionCellCode),
    ),
  };
}

function findPoolEntrySolution(
  difficulty: ReflectionDifficulty,
  problemId: string,
): ReflectionBoard | null {
  for (const [candidateIndex, encodedSolution] of problemPool.levels[
    difficulty
  ] satisfies readonly ReflectionProblemPoolEntry[]) {
    const solution = decodeSolution(encodedSolution);
    if (!isReflectionBoardSize(solution.size)) {
      continue;
    }
    const identity = createReflectionProblemIdentity(
      solution.size,
      getReflectionInventoryPieceCount(countReflectionBoardPieces(solution)),
      candidateIndex,
    );
    if (createProblemId(identity) === problemId) {
      return solution;
    }
  }
  return null;
}

/** 問題集の問題 ID の問題を、解のとおりに置くための操作の並び。 */
export function listReflectionSolutionPlacements(
  difficulty: ReflectionDifficulty,
  problemId: string,
): ReflectionSolutionPlacement[] {
  const solution = findPoolEntrySolution(difficulty, problemId);
  if (!solution) {
    throw new Error(
      `問題集のレベル ${difficulty} に問題 ID ${problemId} がない`,
    );
  }
  return solution.cells.flatMap((piece, cellIndex) => {
    if (piece === null) {
      return [];
    }
    const row = Math.floor(cellIndex / solution.size) + 1;
    const column = (cellIndex % solution.size) + 1;
    return [
      {
        stockPieceName: reflectionPieceLabels[piece],
        emptyCellName: `${row}行${column}列 空き`,
      },
    ];
  });
}

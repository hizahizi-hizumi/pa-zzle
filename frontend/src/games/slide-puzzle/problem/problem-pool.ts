import {
  createBoardSizeFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import {
  SLIDE_PUZZLE_GENERATOR_VERSION,
  type SlidePuzzleIdentifiedProblem,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import problemPoolJson from "@/games/slide-puzzle/problem/problem-pool.json";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

export type SlidePuzzleProblemPoolEntry = readonly [
  seed: string,
  boardSize: SlidePuzzleBoardSize,
  scrambleLength: number,
  optimalMoveCount: number,
];

type SlidePuzzleProblemPool = {
  generatorVersion: typeof SLIDE_PUZZLE_GENERATOR_VERSION;
  levels: Record<SlidePuzzleDifficulty, readonly SlidePuzzleProblemPoolEntry[]>;
};

/** 問題集の1項目を読み解いた値。問題は生成器で復元する。 */
type SlidePuzzleDecodedPoolEntry = {
  identity: SlidePuzzleProblemIdentity;
  optimalMoveCount: number;
};

/** 問題集から復元した1問。評価の基準になる最短手数を伴う。 */
export type SlidePuzzlePooledProblem = SlidePuzzleIdentifiedProblem & {
  optimalMoveCount: number;
};

const problemPool = problemPoolJson as unknown as SlidePuzzleProblemPool;

export function decodeSlidePuzzlePoolEntry([
  seed,
  boardSize,
  scrambleLength,
  optimalMoveCount,
]: SlidePuzzleProblemPoolEntry): SlidePuzzleDecodedPoolEntry {
  return {
    identity: {
      generatorVersion: SLIDE_PUZZLE_GENERATOR_VERSION,
      seed,
      conditions: { size: boardSize, scrambleLength },
    },
    optimalMoveCount,
  };
}

export function listSlidePuzzlePoolEntries(
  difficulty: SlidePuzzleDifficulty,
): readonly SlidePuzzleProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  (entry) => decodeSlidePuzzlePoolEntry(entry).identity,
);

/** 難易度の問題集の全問の問題 ID を、問題集の並び順で返す。 */
export function listSlidePuzzlePoolProblemIds(
  difficulty: SlidePuzzleDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findSlidePuzzlePoolEntryByProblemId(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): SlidePuzzleProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

/** 診断用。問題集に無い識別情報なら `null` を返す。 */
export function findSlidePuzzlePooledOptimalMoveCount(
  identity: SlidePuzzleProblemIdentity,
): number | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }

  for (const entries of Object.values(problemPool.levels)) {
    const entry = entries.find(
      ([seed, boardSize, scrambleLength]) =>
        seed === identity.seed &&
        boardSize === identity.conditions.size &&
        scrambleLength === identity.conditions.scrambleLength,
    );
    if (entry) {
      return entry[3];
    }
  }
  return null;
}

/** 始めたときの盤面を見れば分かる、問題の特徴。 */
export type SlidePuzzleProblemFeatures = {
  boardSize: SlidePuzzleBoardSize;
};

/** 難易度の問題集の1問の特徴を、問題を復元せずに問題集の項目から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findSlidePuzzlePoolProblemFeatures(
  difficulty: SlidePuzzleDifficulty,
  problemId: string,
): SlidePuzzleProblemFeatures | null {
  const entry = findSlidePuzzlePoolEntryByProblemId(difficulty, problemId);
  return entry ? { boardSize: entry[1] } : null;
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。 */
export const slidePuzzleProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ boardSize }) {
      return createBoardSizeFeatureValue(boardSize, boardSize);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<SlidePuzzleProblemFeatures>[];

export type SlidePuzzleProblemFeatureAxisId =
  (typeof slidePuzzleProblemFeatureAxes)[number]["id"];

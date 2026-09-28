import {
  analyzeNanpureDifficulty,
  type NanpureDifficultyAnalysis,
} from "@/games/nanpure/problem/difficulty-analysis";
import { traceNanpureHumanSolve } from "@/games/nanpure/problem/generation/human-solver";
import {
  classifyNanpureSolutions,
  findNanpureSolution,
} from "@/games/nanpure/problem/generation/solver";
import {
  NANPURE_GENERATOR_VERSION,
  type NanpureIdentifiedProblem,
  type NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import {
  listNanpureTechniquesUpTo,
  type NanpureTechnique,
} from "@/games/nanpure/problem/technique";
import {
  NANPURE_CELL_COUNT,
  type NanpureBoard,
  type NanpureCell,
  type NanpureSolution,
} from "@/games/nanpure/puzzle/board";
import {
  createProblemSeededRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";

export type NanpureGeneratedProblem = NanpureIdentifiedProblem & {
  difficultyAnalysis: NanpureDifficultyAnalysis;
};

type CluesAcceptance = (clues: NanpureBoard) => boolean;

/** 手筋はどれも健全なので、上限までの手筋で解き切れるヒントは一意解になる。 */
function createCluesAcceptance(
  removalTechniqueLimit: NanpureTechnique | null,
): CluesAcceptance {
  if (removalTechniqueLimit === null) {
    return function isUnique(clues) {
      return classifyNanpureSolutions(clues).status === "unique";
    };
  }
  const techniques = listNanpureTechniquesUpTo(removalTechniqueLimit);
  return function isSolvableByTechniques(clues) {
    return traceNanpureHumanSolve(clues, { techniques }).status === "solved";
  };
}

/** 解の全マスをヒントとして始め、乱数で決まる順にマスを1つずつ消す。消すと条件を満たさなくなるマスは残す。 */
function removeClues(
  solution: NanpureSolution,
  acceptsClues: CluesAcceptance,
  random: () => number,
): NanpureBoard {
  const clues: NanpureCell[] = [...solution];
  const removalOrder = shuffleProblemValues(
    Array.from({ length: NANPURE_CELL_COUNT }, (_, cellIndex) => cellIndex),
    random,
  );
  for (const cellIndex of removalOrder) {
    const digit = clues[cellIndex] ?? null;
    clues[cellIndex] = null;
    if (!acceptsClues(clues)) {
      clues[cellIndex] = digit;
    }
  }
  return clues;
}

function validateIdentity(identity: NanpureProblemIdentity): void {
  if (identity.generatorVersion !== NANPURE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Nanpure generator version: ${identity.generatorVersion}`,
    );
  }
}

/**
 * identity の seed から完成盤を作り、ヒントを減らして問題にし、難易度を分析する。
 * 同じ identity からは同じ問題を作る。難易度を指定して作る機能は持たず、
 * 問題集の生成スクリプトが、できた問題を分類して各難易度へ振り分ける。
 */
export function generateNanpureProblem(
  identity: NanpureProblemIdentity,
): NanpureGeneratedProblem {
  validateIdentity(identity);
  const random = createProblemSeededRandom(`nanpure:${identity.seed}`);
  const solution = findNanpureSolution(
    Array.from({ length: NANPURE_CELL_COUNT }, () => null),
    { random },
  );
  if (solution === null) {
    throw new Error("An empty Nanpure board must have a solution");
  }
  const clues = removeClues(
    solution,
    createCluesAcceptance(identity.conditions.removalTechniqueLimit),
    random,
  );
  const problem = { clues, solution };
  return {
    problem,
    identity,
    difficultyAnalysis: analyzeNanpureDifficulty(clues),
  };
}

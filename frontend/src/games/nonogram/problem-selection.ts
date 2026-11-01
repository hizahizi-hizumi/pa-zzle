import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import {
  createNonogramCandidateIdentity,
  generateNonogramProblem,
} from "@/games/nonogram/problem/generator";
import type { NonogramIdentifiedProblem } from "@/games/nonogram/problem/problem";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import { createProblemId } from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 仮の出題範囲。難易度を分析せずに出すので、レベルの難しさは保証しない。
 * 盤面の大きさは、実装前提調査の組み合わせ案でそのレベルに許す範囲をそのまま使う。
 */
const provisionalBoardSizesByDifficulty = {
  "1": [
    { width: 7, height: 7 },
    { width: 8, height: 8 },
  ],
  "2": [
    { width: 8, height: 8 },
    { width: 9, height: 9 },
  ],
  "3": [
    { width: 9, height: 9 },
    { width: 10, height: 10 },
  ],
  "4": [
    { width: 10, height: 10 },
    { width: 10, height: 12 },
  ],
  "5": [
    { width: 10, height: 12 },
    { width: 10, height: 13 },
    { width: 10, height: 15 },
  ],
} as const satisfies Record<NonogramDifficulty, readonly NonogramGridSize[]>;

/** 大きさごとに試す候補番号の数。候補番号 0 からこの数までのうち、生成器が問題にした候補を固定の一覧にする。 */
const PROVISIONAL_CANDIDATES_PER_SIZE = 24;

const provisionalProblemsByDifficulty = new Map<
  NonogramDifficulty,
  readonly NonogramIdentifiedProblem[]
>();

function generateProvisionalProblems(
  difficulty: NonogramDifficulty,
): NonogramIdentifiedProblem[] {
  return provisionalBoardSizesByDifficulty[difficulty].flatMap((size) =>
    Array.from(
      { length: PROVISIONAL_CANDIDATES_PER_SIZE },
      (_, candidateIndex) =>
        generateNonogramProblem(
          createNonogramCandidateIdentity(size, candidateIndex),
        ),
    ).flatMap((generated) =>
      generated.status === "accepted"
        ? [
            {
              problem: generated.generated.problem,
              identity: generated.generated.identity,
            },
          ]
        : [],
    ),
  );
}

/** 難易度の仮の一覧。一覧は固定なので、URL の問題 ID から問題を引ける。最初に使うときに作る。 */
function listProvisionalProblems(
  difficulty: NonogramDifficulty,
): readonly NonogramIdentifiedProblem[] {
  let problems = provisionalProblemsByDifficulty.get(difficulty);
  if (problems === undefined) {
    problems = generateProvisionalProblems(difficulty);
    provisionalProblemsByDifficulty.set(difficulty, problems);
  }
  return problems;
}

/** 難易度の仮の一覧から seed で1問を選ぶ。 */
export function selectNonogramProblemForDifficulty(
  difficulty: NonogramDifficulty,
  seed: ProblemSeed,
): NonogramIdentifiedProblem {
  return selectProblemPoolEntry(
    listProvisionalProblems(difficulty),
    seed,
    `level ${difficulty} Nonogram`,
  );
}

/** 難易度の仮の一覧から問題 ID で1問を引く。引けない ID には `null` を返す。 */
export function selectNonogramProblemById(
  difficulty: NonogramDifficulty,
  problemId: string,
): NonogramIdentifiedProblem | null {
  return (
    listProvisionalProblems(difficulty).find(
      ({ identity }) => createProblemId(identity) === problemId,
    ) ?? null
  );
}

export const _private = {
  provisionalBoardSizesByDifficulty,
  listProvisionalProblems,
};

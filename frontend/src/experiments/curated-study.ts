import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import type { DifficultyLevel } from "@/games/difficulty";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import type { ProblemId } from "@/games/problem-id";

export type CuratedStudyGameId = "nanpure" | "parking-jam";
export type CuratedStudySetId = "a" | "b";

export type CuratedStudyCandidate = {
  difficulty: DifficultyLevel;
  problemId: ProblemId;
  seed: string;
};

type CuratedStudyCandidates = readonly [
  CuratedStudyCandidate,
  ...CuratedStudyCandidate[],
];

type CuratedStudyGame = {
  name: string;
  zukanPath: string;
  playPath: string;
  sets: Readonly<Record<CuratedStudySetId, CuratedStudyCandidates>>;
};

/** 問題内容と提示方法を独立に比較するため、難易度と問題規模を合わせた固定セット。研究用ラベルから選定方針を公開しない。 */
export const curatedStudyGames: Readonly<
  Record<CuratedStudyGameId, CuratedStudyGame>
> = {
  nanpure: {
    name: NANPURE_DISPLAY_NAME,
    zukanPath: "/puzzles/nanpure/zukan",
    playPath: "/puzzles/nanpure/play",
    sets: {
      a: [
        {
          difficulty: "3",
          problemId: "4j11bcavdg",
          seed: "np-locked-candidates-231",
        },
        {
          difficulty: "4",
          problemId: "kpuccjpkot",
          seed: "np-hidden-triple-111",
        },
        { difficulty: "5", problemId: "dg4gqkv1b8", seed: "np-uniqueness-299" },
        {
          difficulty: "3",
          problemId: "iega290o5h",
          seed: "np-locked-candidates-343",
        },
        {
          difficulty: "4",
          problemId: "ap652ts3dm",
          seed: "np-uniqueness-1399",
        },
        { difficulty: "5", problemId: "434eh6j81g", seed: "np-xyz-wing-935" },
      ],
      b: [
        {
          difficulty: "3",
          problemId: "n4cg2fuhrh",
          seed: "np-locked-candidates-198",
        },
        {
          difficulty: "4",
          problemId: "8nn8d34hat",
          seed: "np-hidden-triple-670",
        },
        { difficulty: "5", problemId: "uadf12p07p", seed: "np-uniqueness-12" },
        {
          difficulty: "3",
          problemId: "kcbdd0jun1",
          seed: "np-locked-candidates-560",
        },
        {
          difficulty: "4",
          problemId: "ncj0hjqnjo",
          seed: "np-uniqueness-2076",
        },
        { difficulty: "5", problemId: "o5l14nlj9j", seed: "np-xyz-wing-1077" },
      ],
    },
  },
  "parking-jam": {
    name: PARKING_JAM_DISPLAY_NAME,
    zukanPath: "/puzzles/parking-jam/zukan",
    playPath: "/puzzles/parking-jam/play",
    sets: {
      a: [
        { difficulty: "3", problemId: "57vqfvov05", seed: "pj-pool-2" },
        { difficulty: "4", problemId: "lqnl3eak14", seed: "pj-pool-4" },
        { difficulty: "5", problemId: "igijlgam97", seed: "pj-pool-151" },
        { difficulty: "3", problemId: "tdhqbs3op7", seed: "pj-pool-21" },
        { difficulty: "4", problemId: "1g3rfs9ldn", seed: "pj-pool-7" },
        { difficulty: "5", problemId: "am62qodmb5", seed: "pj-pool-189" },
      ],
      b: [
        { difficulty: "3", problemId: "2rgr0me1pk", seed: "pj-pool-63" },
        { difficulty: "4", problemId: "jtcvqa3907", seed: "pj-pool-48" },
        { difficulty: "5", problemId: "693672sl8f", seed: "pj-pool-224" },
        { difficulty: "3", problemId: "odmj6kjcva", seed: "pj-pool-40" },
        { difficulty: "4", problemId: "fscbepvkrr", seed: "pj-pool-75" },
        { difficulty: "5", problemId: "a4f7m2e444", seed: "pj-pool-257" },
      ],
    },
  },
};

export function getCuratedCandidatePlayUrl(
  gameId: CuratedStudyGameId,
  candidate: CuratedStudyCandidate,
): string {
  const game = curatedStudyGames[gameId];
  return `${game.playPath}/${candidate.difficulty}${createProblemIdSearch(candidate.problemId)}`;
}

export function getCuratedRandomPlayUrl(
  gameId: CuratedStudyGameId,
  difficulty: DifficultyLevel,
): string {
  return `${curatedStudyGames[gameId].playPath}/${difficulty}`;
}

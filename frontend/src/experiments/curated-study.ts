import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import type { DifficultyLevel } from "@/games/difficulty";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import type { ProblemId } from "@/games/problem-id";

export type CuratedStudyGameId = "nanpure" | "parking-jam";
export type CuratedStudySetId = "a" | "b" | "c";

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
      c: [
        {
          difficulty: "3",
          problemId: "4d921err5v",
          seed: "np-locked-candidates-930",
        },
        {
          difficulty: "4",
          problemId: "osi09dl2ep",
          seed: "np-hidden-triple-491",
        },
        { difficulty: "5", problemId: "28ufj6u625", seed: "np-uniqueness-630" },
        {
          difficulty: "3",
          problemId: "t1g9j4051m",
          seed: "np-locked-candidates-588",
        },
        {
          difficulty: "4",
          problemId: "409rcvcm0h",
          seed: "np-uniqueness-1075",
        },
        { difficulty: "5", problemId: "mkd4b1tn4g", seed: "np-xyz-wing-1211" },
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
      c: [
        { difficulty: "3", problemId: "2srumqfkh3", seed: "pj-pool-8" },
        { difficulty: "4", problemId: "vjnusfbjuu", seed: "pj-pool-1" },
        { difficulty: "5", problemId: "fl7ahhspv7", seed: "pj-pool-271" },
        { difficulty: "3", problemId: "s5kcb091r4", seed: "pj-pool-43" },
        { difficulty: "4", problemId: "32iu18dutc", seed: "pj-pool-74" },
        { difficulty: "5", problemId: "fo54260luf", seed: "pj-pool-315" },
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

/** 試遊条件を結果画面まで引き継ぐための識別子。固定問題と一致しなければ無効。 */
export function createCuratedStudyCode(
  gameId: CuratedStudyGameId,
  setId: CuratedStudySetId,
  position: number,
  participant = false,
  presentation: "list" | "sequence" = "sequence",
): string {
  return `${gameId}.${setId}.${position}${participant ? ".p" : ""}${participant && presentation === "list" ? ".l" : ""}`;
}

export function getCuratedStudyPlayUrl(
  gameId: CuratedStudyGameId,
  setId: CuratedStudySetId,
  position: number,
  participant = false,
  presentation: "list" | "sequence" = "sequence",
): string {
  const candidate = curatedStudyGames[gameId].sets[setId][position];
  if (!candidate) throw new RangeError("Unknown study candidate position");
  const search = new URLSearchParams({
    problem: candidate.problemId,
    study: createCuratedStudyCode(
      gameId,
      setId,
      position,
      participant,
      presentation,
    ),
  });
  return `${curatedStudyGames[gameId].playPath}/${candidate.difficulty}?${search}`;
}

export function getCuratedStudyContinuation(
  studyCode: string | null,
  gameId: string,
  difficulty: string,
  problemId: string,
): { destination: string; label: string } | null {
  if (!studyCode) return null;
  const match = /^(nanpure|parking-jam)\.(a|b|c)\.([0-5])(\.p)?(\.l)?$/.exec(
    studyCode,
  );
  if (!match || match[1] !== gameId) return null;
  const setId = match[2] as CuratedStudySetId;
  const position = Number(match[3]);
  const participant = match[4] === ".p";
  if (match[5] && !participant) return null;
  const listPresentation = participant && match[5] === ".l";
  const candidate =
    curatedStudyGames[gameId as CuratedStudyGameId].sets[setId][position];
  if (
    !candidate ||
    candidate.problemId !== problemId ||
    candidate.difficulty !== difficulty
  )
    return null;
  if (listPresentation) {
    const params = new URLSearchParams({
      game: gameId,
      set: setId,
      presentation: "list",
      participant: "1",
    });
    return { destination: `/studies/curated?${params}`, label: "一覧へ戻る" };
  }
  if (position < 5) {
    return {
      destination: getCuratedStudyPlayUrl(
        gameId as CuratedStudyGameId,
        setId,
        position + 1,
        participant,
      ),
      label: "次の問題",
    };
  }
  const params = new URLSearchParams({
    game: gameId,
    set: setId,
    presentation: "sequence",
    position: "5",
    finished: "1",
  });
  if (participant) params.set("participant", "1");
  return { destination: `/studies/curated?${params}`, label: "比較画面へ戻る" };
}

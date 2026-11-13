import type { PlayRecord } from "@/features/records/play-record";
import {
  type GameZukan,
  getZukanProblemStatus,
  type ZukanDifficultySection,
  type ZukanGameSource,
  type ZukanProblemStatus,
} from "@/features/zukan/zukan-collection";
import {
  findZukanChanges,
  type ZukanViewedStatuses,
} from "@/features/zukan/zukan-last-viewed";
import type { DifficultyLevel } from "@/games/difficulty";

/**
 * ゲームのホームを開いたときに開く台紙。選んだ難易度、無ければ最後にクリアまたは離脱した難易度、それも無ければ最も低い難易度の台紙。
 * 問題の無い難易度は開かない。開ける台紙が無ければ `null`。
 */
export function findZukanOpenSection(
  zukan: Pick<GameZukan, "sections" | "latestPlayedDifficulty">,
  chosenDifficulty: DifficultyLevel | null = null,
): ZukanDifficultySection | null {
  const sections = zukan.sections.filter(({ problems }) => problems.length > 0);
  return (
    sections.find(({ difficulty }) => difficulty === chosenDifficulty) ??
    sections.find(
      ({ difficulty }) => difficulty === zukan.latestPlayedDifficulty,
    ) ??
    sections[0] ??
    null
  );
}

/** ゲームのホームを開く前に見せる、開く台紙の全問の状態（番号の順）と、そのゲームで最後に解いた問題の番号の順の位置。 */
export type ZukanOpenSheet = {
  difficulty: DifficultyLevel;
  /** 前回図鑑を見たときから変化した問題は、変化する前の状態。 */
  statuses: readonly ZukanProblemStatus[];
  /** 最後に解いた問題がその台紙に無ければ `null`。 */
  latestSolvedIndex: number | null;
};

function findLatestRecord(
  gameId: string,
  records: readonly PlayRecord[],
): PlayRecord | null {
  let latest: PlayRecord | null = null;
  for (const record of records) {
    if (
      record.gameId === gameId &&
      (latest === null || record.completedAt > latest.completedAt)
    ) {
      latest = record;
    }
  }
  return latest;
}

type ZukanRecordSource = Pick<
  ZukanGameSource,
  "id" | "recordProblemPlayTarget"
>;

function findLatestSolvedIndex(
  game: ZukanRecordSource,
  records: readonly PlayRecord[],
  section: ZukanDifficultySection,
): number | null {
  const latest = findLatestRecord(game.id, records);
  const target = latest === null ? null : game.recordProblemPlayTarget(latest);
  if (target === null || target.difficulty !== section.difficulty) {
    return null;
  }
  const index = section.problems.findIndex(
    ({ problemId }) => problemId === target.problemId,
  );
  return index === -1 ? null : index;
}

/** `zukan` は `game` の `records` から導いた図鑑。`lastViewed` は前回図鑑を見たときの状態。 */
export function findZukanOpenSheet(
  game: ZukanRecordSource,
  zukan: GameZukan,
  records: readonly PlayRecord[],
  lastViewed: ZukanViewedStatuses | null,
): ZukanOpenSheet | null {
  const section = findZukanOpenSection(zukan);
  if (section === null) {
    return null;
  }
  const changes = findZukanChanges(zukan, lastViewed).byDifficulty[
    section.difficulty
  ];
  return {
    difficulty: section.difficulty,
    statuses: section.problems.map(
      (problem) =>
        changes?.get(problem.problemId)?.previousStatus ??
        getZukanProblemStatus(problem),
    ),
    latestSolvedIndex: findLatestSolvedIndex(game, records, section),
  };
}

/**
 * 台紙 `difficulty` の番号の順で `index` 番目の1問だけを、今の状態で見たことにした、前回図鑑を見たときの状態。
 * 同じ難易度のほかの問題の状態は変えない。
 * 前回の状態が無いとき（`lastViewed` が `null`）は、1問だけを書くとほかの解いた問題がすべて変化になるので、`null` を返して書かせない。
 * 見たことにする問題が無いときと、まだ触れていない問題のときも `null`。
 */
export function markZukanProblemViewed(
  zukan: GameZukan,
  lastViewed: ZukanViewedStatuses | null,
  difficulty: string,
  index: number,
): ZukanViewedStatuses | null {
  const section = zukan.sections.find(
    (candidate) => candidate.difficulty === difficulty,
  );
  const problem = section?.problems[index];
  if (lastViewed === null || section === undefined || problem === undefined) {
    return null;
  }
  const status = getZukanProblemStatus(problem);
  if (status === "untouched") {
    return null;
  }
  return {
    [section.difficulty]: {
      ...lastViewed[section.difficulty],
      [problem.problemId]: status,
    },
  };
}

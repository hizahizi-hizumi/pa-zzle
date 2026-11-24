import type { PlayRecord } from "@/features/records/play-record";
import type {
  GameZukan,
  ZukanDifficultySection,
  ZukanGameSource,
  ZukanProblem,
} from "@/features/zukan/zukan-collection";
import type { ZukanViewedStatuses } from "@/features/zukan/zukan-last-viewed";
import {
  findZukanOpenSection,
  findZukanOpenSheet,
  markZukanProblemViewed,
} from "@/features/zukan/zukan-open-sheet";
import { type DifficultyLevel, difficultyLevels } from "@/games/difficulty";

type RecordedProblem = { difficulty: string; problemId: string };

function solved(
  difficulty: DifficultyLevel,
  problemId: string,
  bestScore: number,
): ZukanProblem {
  return {
    kind: "solved",
    number: 1,
    difficulty,
    problemId,
    bestScore,
    fastestElapsedMs: 60_000,
    fewestMoves: null,
    fewestMistakes: null,
    firstCompletedAt: 0,
  };
}

function unsolved(
  difficulty: DifficultyLevel,
  problemId: string,
  attempted = false,
): ZukanProblem {
  return { kind: "unsolved", number: 1, difficulty, problemId, attempted };
}

function createZukan(
  problemsByDifficulty: Partial<Record<DifficultyLevel, ZukanProblem[]>>,
  latestPlayedDifficulty: DifficultyLevel | null,
): GameZukan {
  const sections = difficultyLevels.map(({ id }): ZukanDifficultySection => {
    const problems = problemsByDifficulty[id] ?? [];
    return {
      difficulty: id,
      problems,
      solvedCount: problems.filter(({ kind }) => kind === "solved").length,
    };
  });
  return { sections, problemCount: 0, solvedCount: 0, latestPlayedDifficulty };
}

function createRecord(
  completedAt: number,
  payload: RecordedProblem,
  gameId = "game",
): PlayRecord {
  return {
    id: `record-${completedAt}`,
    gameId,
    startedAt: completedAt - 1_000,
    completedAt,
    payloadVersion: 1,
    payload,
  };
}

const game: Pick<ZukanGameSource, "id" | "recordProblemPlayTarget"> = {
  id: "game",
  recordProblemPlayTarget(record) {
    return record.payload as RecordedProblem;
  },
};

const zukan = createZukan(
  {
    "1": [solved("1", "a", 100), unsolved("1", "b", true)],
    "3": [solved("3", "c", 85), solved("3", "d", 70), unsolved("3", "e")],
  },
  "3",
);

describe("findZukanOpenSection", () => {
  test("最後にクリアまたは離脱した難易度の台紙を返すこと", () => {
    const section = findZukanOpenSection(zukan);

    expect(section?.difficulty).toBe("3");
  });

  test("選んだ難易度があれば、その台紙を返すこと", () => {
    const section = findZukanOpenSection(zukan, "1");

    expect(section?.difficulty).toBe("1");
  });

  describe("遊んだことが無い場合", () => {
    const unplayedZukan = createZukan({ "2": [unsolved("2", "f")] }, null);

    test("問題のある最も低い難易度の台紙を返すこと", () => {
      const section = findZukanOpenSection(unplayedZukan);

      expect(section?.difficulty).toBe("2");
    });
  });
});

describe("findZukanOpenSheet", () => {
  const records = [
    createRecord(1, { difficulty: "3", problemId: "c" }),
    createRecord(3, { difficulty: "3", problemId: "d" }),
    createRecord(5, { difficulty: "1", problemId: "a" }, "other-game"),
  ];

  describe("前回図鑑を見たときから変化がある場合", () => {
    const lastViewed: ZukanViewedStatuses = { "3": { c: "good" } };

    test("変化した問題を、変化する前の状態で描くこと", () => {
      const sheet = findZukanOpenSheet(game, zukan, records, lastViewed);

      expect(sheet?.difficulty).toBe("3");
      expect(sheet?.statuses).toEqual(["good", "untouched", "untouched"]);
    });
  });

  describe("前回の状態が無い場合", () => {
    test("今の状態で描き、そのゲームで最後に解いた問題の位置を返すこと", () => {
      const sheet = findZukanOpenSheet(game, zukan, records, null);

      expect(sheet?.statuses).toEqual(["good", "clear", "untouched"]);
      expect(sheet?.latestSolvedIndex).toBe(1);
    });
  });
});

describe("markZukanProblemViewed", () => {
  describe("前回の状態がある場合", () => {
    const lastViewed: ZukanViewedStatuses = {
      "1": { a: "perfect" },
      "3": {},
    };

    test("はまった1問だけを今の状態で見たことにし、同じ難易度のほかの変化は残すこと", () => {
      const viewed = markZukanProblemViewed(zukan, lastViewed, "3", 0);

      expect(viewed).toEqual({ "3": { c: "good" } });
    });
  });

  describe("前回の状態が無い場合", () => {
    test("書かせないよう null を返すこと", () => {
      const viewed = markZukanProblemViewed(zukan, null, "3", 0);

      expect(viewed).toBeNull();
    });
  });
});

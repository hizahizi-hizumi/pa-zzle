import { describe, expect, test } from "vitest";
import {
  type CuratedStudyGameId,
  curatedStudyGames,
  getCuratedCandidatePlayUrl,
  getCuratedRandomPlayUrl,
  getCuratedStudyContinuation,
  getCuratedStudyPlayUrl,
} from "@/experiments/curated-study";
import {
  decodeNanpurePoolProblem,
  findNanpurePoolEntryByProblemId,
  toNanpurePoolIdentity,
} from "@/games/nanpure/problem/problem-pool";
import {
  findParkingJamPoolEntryByProblemId,
  toParkingJamPoolIdentity,
} from "@/games/parking-jam/problem/problem-pool";
import { createProblemId } from "@/games/problem-id";

const gameIds = ["nanpure", "parking-jam"] as const;
const setIds = ["a", "b", "c"] as const;

const eachCandidate = gameIds.flatMap((gameId) =>
  setIds.flatMap((setId) =>
    curatedStudyGames[gameId].sets[setId].map((candidate) => ({
      gameId,
      setId,
      candidate,
    })),
  ),
);

function getCandidateIdentity(
  gameId: CuratedStudyGameId,
  candidate: { difficulty: "1" | "2" | "3" | "4" | "5"; problemId: string },
) {
  if (gameId === "nanpure") {
    const entry = findNanpurePoolEntryByProblemId(
      candidate.difficulty,
      candidate.problemId,
    );
    return entry === null ? null : toNanpurePoolIdentity(entry);
  }
  const entry = findParkingJamPoolEntryByProblemId(
    candidate.difficulty,
    candidate.problemId,
  );
  return entry === null ? null : toParkingJamPoolIdentity(entry);
}

describe("curatedStudyGames", () => {
  test.each(gameIds)(
    "%s の比較セットは重複せず、レベル配列が対応すること",
    (gameId) => {
      const a = curatedStudyGames[gameId].sets.a;
      const b = curatedStudyGames[gameId].sets.b;
      const c = curatedStudyGames[gameId].sets.c;
      const levels = ["3", "4", "5", "3", "4", "5"];

      expect(a.map(({ difficulty }) => difficulty)).toEqual(levels);
      expect(b.map(({ difficulty }) => difficulty)).toEqual(levels);
      expect(c.map(({ difficulty }) => difficulty)).toEqual(levels);
      expect(
        new Set([...a, ...b, ...c].map(({ problemId }) => problemId)).size,
      ).toBe(a.length + b.length + c.length);
    },
  );

  test.each(eachCandidate)(
    "$gameId / $setId の $candidate.problemId は元問題集に存在し、IDとseedが一致すること",
    ({ gameId, candidate }) => {
      const identity = getCandidateIdentity(gameId, candidate);
      expect(identity).not.toBeNull();
      expect(identity?.seed).toBe(candidate.seed);
      expect(identity && createProblemId(identity)).toBe(candidate.problemId);
    },
  );

  test.each(gameIds)(
    "%s の比較セットは問題の規模を対応させること",
    (gameId) => {
      for (let index = 0; index < 6; index += 1) {
        const a = curatedStudyGames[gameId].sets.a[index];
        const b = curatedStudyGames[gameId].sets.b[index];
        const c = curatedStudyGames[gameId].sets.c[index];
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        if (!a || !b || !c) continue;
        if (gameId === "nanpure") {
          const entryA = findNanpurePoolEntryByProblemId(
            a.difficulty,
            a.problemId,
          );
          const entryB = findNanpurePoolEntryByProblemId(
            b.difficulty,
            b.problemId,
          );
          expect(entryA).not.toBeNull();
          expect(entryB).not.toBeNull();
          const entryC = findNanpurePoolEntryByProblemId(
            c.difficulty,
            c.problemId,
          );
          expect(entryC).not.toBeNull();
          if (!entryA || !entryB || !entryC) continue;
          const cluesA = decodeNanpurePoolProblem(entryA[2]).clues;
          const cluesB = decodeNanpurePoolProblem(entryB[2]).clues;
          expect(cluesA.filter((value) => value !== null).length).toBe(
            cluesB.filter((value) => value !== null).length,
          );
          expect(cluesA.filter((value) => value !== null).length).toBe(
            decodeNanpurePoolProblem(entryC[2]).clues.filter(
              (value) => value !== null,
            ).length,
          );
          continue;
        }
        const identityA = getCandidateIdentity(gameId, a);
        const identityB = getCandidateIdentity(gameId, b);
        const identityC = getCandidateIdentity(gameId, c);
        expect(identityA).not.toBeNull();
        expect(identityB).not.toBeNull();
        expect(identityC).not.toBeNull();
        if (!identityA || !identityB || !identityC) continue;
        if (
          !("width" in identityA.conditions) ||
          !("width" in identityB.conditions) ||
          !("width" in identityC.conditions)
        )
          continue;
        const {
          width,
          height,
          vehicleCount,
          fixedAreaCount,
          roadOpeningCount,
        } = identityA.conditions;
        expect(identityB.conditions).toMatchObject({
          width,
          height,
          vehicleCount,
          fixedAreaCount,
          roadOpeningCount,
        });
        expect(identityC.conditions).toMatchObject({
          width,
          height,
          vehicleCount,
          fixedAreaCount,
          roadOpeningCount,
        });
      }
    },
  );
});

describe("getCuratedCandidatePlayUrl", () => {
  test.each(eachCandidate)(
    "$gameId / $setId の候補 $candidate.problemId を既存プレイ画面で開くこと",
    ({ gameId, candidate }) => {
      expect(getCuratedCandidatePlayUrl(gameId, candidate)).toBe(
        `/puzzles/${gameId}/play/${candidate.difficulty}?problem=${candidate.problemId}`,
      );
    },
  );
});

describe("getCuratedRandomPlayUrl", () => {
  test.each(gameIds)(
    "%s のランダム出題に問題IDを指定しないこと",
    (gameId: CuratedStudyGameId) => {
      expect(getCuratedRandomPlayUrl(gameId, "3")).toBe(
        `/puzzles/${gameId}/play/3`,
      );
    },
  );
});

describe("getCuratedStudyPlayUrl", () => {
  test("試遊者の一覧提示は結果画面から戻る条件を問題URLに保存すること", () => {
    const url = getCuratedStudyPlayUrl("nanpure", "c", 0, true, "list");

    expect(url).toBe(
      "/puzzles/nanpure/play/3?problem=4d921err5v&study=nanpure.c.0.p.l",
    );
  });
});

describe("getCuratedStudyContinuation", () => {
  test("一覧提示の結果は順番を強制せず元の一覧に戻すこと", () => {
    const continuation = getCuratedStudyContinuation(
      "nanpure.c.0.p.l",
      "nanpure",
      "3",
      "4d921err5v",
    );

    expect(continuation).toEqual({
      destination:
        "/studies/curated?game=nanpure&set=c&presentation=list&participant=1",
      label: "一覧へ戻る",
    });
  });

  test("固定した問題IDと難易度が一致する試遊に限り次の問題を指定すること", () => {
    const next = getCuratedStudyContinuation(
      "nanpure.c.0",
      "nanpure",
      "3",
      "4d921err5v",
    );

    expect(next).toEqual({
      destination:
        "/puzzles/nanpure/play/4?problem=osi09dl2ep&study=nanpure.c.1",
      label: "次の問題",
    });
  });

  test("最終問題の次は研究用の比較画面に戻すこと", () => {
    const last = curatedStudyGames["parking-jam"].sets.b[5];
    if (!last) throw new Error("Missing last candidate");
    const next = getCuratedStudyContinuation(
      "parking-jam.b.5",
      "parking-jam",
      last.difficulty,
      last.problemId,
    );

    expect(next?.label).toBe("比較画面へ戻る");
    expect(next?.destination).toContain(
      "/studies/curated?game=parking-jam&set=b",
    );
    expect(next?.destination).toContain("finished=1");
  });

  test.each([
    ["別ゲーム", "parking-jam.c.0", "nanpure", "3", "4d921err5v"],
    ["異なる難易度", "nanpure.c.0", "nanpure", "4", "4d921err5v"],
    ["異なるID", "nanpure.c.0", "nanpure", "3", "wrong"],
    ["範囲外", "nanpure.c.9", "nanpure", "3", "4d921err5v"],
    ["不正な文字列", "nanpure.c.0.trail", "nanpure", "3", "4d921err5v"],
  ])(
    "%s に対して試遊の次問指定を行わないこと",
    (_title, code, game, level, problem) => {
      const next = getCuratedStudyContinuation(code, game, level, problem);

      expect(next).toBeNull();
    },
  );

  test("各候補の連続プレイURLが自分の試遊条件を保持すること", () => {
    const url = getCuratedStudyPlayUrl("nanpure", "c", 0);

    expect(url).toBe(
      "/puzzles/nanpure/play/3?problem=4d921err5v&study=nanpure.c.0",
    );
  });
});

import { createTsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import { formatTsumeShogiProblemText } from "@/games/tsume-shogi/problem/problem";
import { toTsumeShogiPooledProblem } from "@/games/tsume-shogi/problem/problem-pool";

describe("createTsumeShogiDiagnosticSnapshot", () => {
  describe("問題集の問題の場合", () => {
    const pooled = toTsumeShogiPooledProblem("2", 0);

    test("identity・問題集の位置・局面と作意・分析し直した特徴と分類を返すこと", () => {
      const snapshot = createTsumeShogiDiagnosticSnapshot({
        difficulty: "2",
        problemIdentity: pooled.identity,
        poolReference: pooled.poolReference,
        problem: pooled.problem,
        buildRevision: "abc",
      });

      expect(snapshot).toMatchObject({
        formatVersion: 1,
        game: "tsume-shogi",
        difficulty: "2",
        problemIdentity: pooled.identity,
        problemPool: pooled.poolReference,
        problem: formatTsumeShogiProblemText(pooled.problem),
        difficultyFeatures: {
          rootChecks: pooled.workload.rootChecks,
          plausibleWrong: pooled.workload.plausibleWrong,
          deepDecoyCount: pooled.workload.deepDecoyCount,
        },
        difficultyAssessment: { status: "classified", difficulty: "2" },
        buildRevision: "abc",
      });
      expect(snapshot.problemIdentity).not.toBe(pooled.identity);
    });
  });
});

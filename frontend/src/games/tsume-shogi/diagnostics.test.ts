import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createTsumeShogiDiagnosticSnapshot,
} from "@/games/tsume-shogi/diagnostics";
import { formatTsumeShogiProblemText } from "@/games/tsume-shogi/problem/problem";
import {
  storeTsumeShogiProblemPool,
  toTsumeShogiPooledProblem,
} from "@/games/tsume-shogi/problem/problem-pool";
import problemPoolJson from "@/games/tsume-shogi/problem/problem-pool.json";

// 問題集の本体は画面を開いたときに読み込むので、テストではファイルの内容を先に置いておく。
storeTsumeShogiProblemPool(problemPoolJson);

const {
  parseTsumeShogiDiagnosticSnapshot,
  restoreTsumeShogiProblemFromDiagnosticSnapshot,
} = _private;

describe("createTsumeShogiDiagnosticSnapshot", () => {
  describe("問題集の問題の場合", () => {
    const pooled = toTsumeShogiPooledProblem("2", 0);
    const snapshot = createTsumeShogiDiagnosticSnapshot({
      difficulty: "2",
      problemIdentity: pooled.identity,
      poolReference: pooled.poolReference,
      problem: pooled.problem,
      buildRevision: "abc",
    });
    const invalidCases = [
      ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
      ["別のゲーム", { ...snapshot, game: "reflection" }],
      ["未定義の難易度", { ...snapshot, difficulty: "9" }],
      ["問題集の版と番号が無い", { ...snapshot, problemPool: null }],
      ["局面と作意が無い", { ...snapshot, problem: undefined }],
      ["特徴の形が違う", { ...snapshot, difficultyFeatures: {} }],
      [
        "分類の状態が無い",
        { ...snapshot, difficultyAssessment: { status: "unknown" } },
      ],
      [
        "扱わない手数",
        {
          ...snapshot,
          problemIdentity: {
            ...snapshot.problemIdentity,
            conditions: { ...snapshot.problemIdentity.conditions, plies: 7 },
          },
        },
      ],
    ] as const;

    test("identity・問題集の位置・局面と作意・分析し直した特徴と分類を返すこと", () => {
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

    test("コピー形式を復元して同じ問題を再現できること", () => {
      const parsed = parseTsumeShogiDiagnosticSnapshot(
        serializeInternalDiagnosticSnapshot(snapshot),
      );
      const restored = restoreTsumeShogiProblemFromDiagnosticSnapshot(parsed);

      expect(parsed).toEqual(snapshot);
      expect(restored?.problem).toEqual(pooled.problem);
    });

    test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
      function act() {
        return parseTsumeShogiDiagnosticSnapshot(JSON.stringify(value));
      }

      expect(act).toThrow("Invalid tsume-shogi diagnostic snapshot");
    });
  });
});

import { traceNanpureHumanSolve } from "@/games/nanpure/problem/generation/human-solver";
import { classifyNanpureSolutions } from "@/games/nanpure/problem/generation/solver";
import { generateNanpureProblem } from "@/games/nanpure/problem/generator";
import {
  assertNanpureProblem,
  createNanpureProblemIdentity,
  type NanpureProblemIdentity,
} from "@/games/nanpure/problem/problem";
import { listNanpureTechniquesUpTo } from "@/games/nanpure/problem/technique";

describe("generateNanpureProblem", () => {
  describe("手筋の上限を決めた identity", () => {
    const identity = createNanpureProblemIdentity("locked-candidates", 3);

    test("同じ identity から同じ問題と分析を再現すること", () => {
      const first = generateNanpureProblem(identity);
      const second = generateNanpureProblem(identity);

      expect(second).toEqual(first);
    });

    test("解と食い違わない一意解の問題を作ること", () => {
      const { problem } = generateNanpureProblem(identity);

      const classification = classifyNanpureSolutions(problem.clues);
      expect(() => assertNanpureProblem(problem)).not.toThrow();
      expect(classification).toEqual({
        status: "unique",
        solution: problem.solution,
      });
    });

    test("上限までの手筋で解き切れる問題を作ること", () => {
      const { problem } = generateNanpureProblem(identity);

      const result = traceNanpureHumanSolve(problem.clues, {
        techniques: listNanpureTechniquesUpTo("locked-candidates"),
      });
      expect(result.status).toBe("solved");
    });

    test("ヒントをどれか1つ消すと上限までの手筋では解き切れなくなること", () => {
      const { problem } = generateNanpureProblem(identity);

      const removable = problem.clues.flatMap((cell, cellIndex) => {
        if (cell === null) {
          return [];
        }
        const clues = problem.clues.map((clue, index) =>
          index === cellIndex ? null : clue,
        );
        const result = traceNanpureHumanSolve(clues, {
          techniques: listNanpureTechniquesUpTo("locked-candidates"),
        });
        return result.status === "solved" ? [cellIndex] : [];
      });
      expect(removable).toEqual([]);
    });
  });

  describe("一意解だけを保つ identity", () => {
    const identity = createNanpureProblemIdentity(null, 0);

    test("一意解の問題を作ること", () => {
      const { problem } = generateNanpureProblem(identity);

      const classification = classifyNanpureSolutions(problem.clues);
      expect(classification.status).toBe("unique");
    });
  });

  describe("生成器の版が違う identity", () => {
    const identity = {
      ...createNanpureProblemIdentity(null, 0),
      generatorVersion: "1",
    } as unknown as NanpureProblemIdentity;

    test("拒否すること", () => {
      const act = () => generateNanpureProblem(identity);

      expect(act).toThrow();
    });
  });
});

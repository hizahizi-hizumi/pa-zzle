import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import {
  decodeTakuzuPoolProblem,
  encodeTakuzuPoolProblem,
  getTakuzuRemovalTechniqueLimitCode,
  toTakuzuPoolIdentity,
} from "@/games/takuzu/problem/problem-pool";

describe("encodeTakuzuPoolProblem", () => {
  const { problem } = generateTakuzuProblem(
    createTakuzuProblemIdentity("count-completion", 2, 0),
  );

  test("解と初期配置を32桁の16進で表すこと", () => {
    const encoded = encodeTakuzuPoolProblem(problem);

    expect(encoded).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("decodeTakuzuPoolProblem", () => {
  describe("encodeTakuzuPoolProblem で表した問題", () => {
    const { problem } = generateTakuzuProblem(
      createTakuzuProblemIdentity("count-completion", 2, 0),
    );
    const encoded = encodeTakuzuPoolProblem(problem);

    test("元の問題へ戻すこと", () => {
      const decoded = decodeTakuzuPoolProblem(encoded);

      expect(decoded).toEqual(problem);
    });
  });

  describe("桁数の違う表記", () => {
    const encoded = "0".repeat(31);

    test("拒否すること", () => {
      const act = () => decodeTakuzuPoolProblem(encoded);

      expect(act).toThrow();
    });
  });
});

describe("toTakuzuPoolIdentity", () => {
  test("手筋の上限の1文字表記・戻す数・候補番号から identity を作ること", () => {
    const identity = toTakuzuPoolIdentity(["D", 2, 160, "0".repeat(32)]);

    expect(identity).toEqual(
      createTakuzuProblemIdentity("duplicate-avoidance", 2, 160),
    );
    expect(identity.seed).toBe("tk-duplicate-avoidance-2-160");
  });
});

describe("getTakuzuRemovalTechniqueLimitCode", () => {
  const cases = [
    ["adjacency", "A"],
    ["count-completion", "B"],
    ["single-remaining", "C"],
    ["duplicate-avoidance", "D"],
    ["general-line", "E"],
  ] as const;

  test.each(cases)("%s を %s と表すこと", (technique, expected) => {
    const code = getTakuzuRemovalTechniqueLimitCode(technique);

    expect(code).toBe(expected);
  });
});

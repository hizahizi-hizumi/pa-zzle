import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import {
  decodeTakuzuPoolProblem,
  encodeTakuzuPoolProblem,
  toTakuzuPoolIdentity,
} from "@/games/takuzu/problem/problem-pool";

describe("問題集の問題の表記", () => {
  const { problem } = generateTakuzuProblem(
    createTakuzuProblemIdentity("count-completion", 2, 0),
  );

  test("解と初期配置を32桁の16進で表し、同じ問題へ戻せること", () => {
    const encoded = encodeTakuzuPoolProblem(problem);

    expect(encoded).toMatch(/^[0-9a-f]{32}$/);
    expect(decodeTakuzuPoolProblem(encoded)).toEqual(problem);
  });

  test("桁数の違う表記を拒否すること", () => {
    const act = () => decodeTakuzuPoolProblem("0".repeat(31));

    expect(act).toThrow();
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

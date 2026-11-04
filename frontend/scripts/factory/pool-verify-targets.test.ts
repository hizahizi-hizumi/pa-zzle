import { listPoolVerifyTargets } from "./pool-verify-targets";

describe("listPoolVerifyTargets", () => {
  const changes = [
    {
      status: "modified",
      path: "frontend/src/games/nanpure/problem/generator.ts",
    },
    {
      status: "modified",
      path: "frontend/src/games/nanpure/problem/problem-pool.json",
    },
    { status: "modified", path: "frontend/src/games/takuzu/ui/Board.tsx" },
    {
      status: "renamed",
      previousPath: "frontend/src/games/water-sort/problem/old.ts",
      path: "frontend/src/games/water-sort/session/new.ts",
    },
    {
      status: "added",
      path: "frontend/src/games/new-game/problem/generator.ts",
    },
  ] as const;
  const poolScriptFileNames = [
    "generate-nanpure-problem-pool.ts",
    "generate-takuzu-problem-pool.ts",
    "generate-water-sort-problem-pool.ts",
  ];

  test("問題の生成・プールが変わったゲームを、生成スクリプトの有無で分けて返すこと", () => {
    const targets = listPoolVerifyTargets(changes, poolScriptFileNames);

    expect(targets).toEqual({
      games: ["nanpure", "water-sort"],
      gamesWithoutScript: ["new-game"],
    });
  });
});

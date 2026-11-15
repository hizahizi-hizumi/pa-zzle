import {
  readGameGuideDifficulty,
  readGameGuideReturnTo,
} from "@/app/navigation/game-guide-navigation";

describe("readGameGuideReturnTo", () => {
  const gameId = "nanpure";
  const valid = [
    "/puzzles/nanpure",
    "/puzzles/nanpure?level=3",
    "/puzzles/nanpure/play/np-123456",
  ];
  const invalid = [
    "/",
    "/puzzles/water-sort",
    "/puzzles/nanpure/playful",
    "https://example.com",
    "/puzzles/nanpure/tutorial",
  ];

  test.each(valid)("元の画面を開けるURLを取得できること: %s", (returnTo) => {
    const result = readGameGuideReturnTo({ returnTo }, gameId);

    expect(result).toBe(returnTo);
  });

  test.each(invalid)(
    "元の画面として不適切なURLを採用しないこと: %s",
    (returnTo) => {
      const result = readGameGuideReturnTo({ returnTo }, gameId);

      expect(result).toBeNull();
    },
  );
});

describe("readGameGuideDifficulty", () => {
  const selectedLevel = { difficulty: "3" };

  test("ゲームホームで選んだレベルを取得できること", () => {
    const result = readGameGuideDifficulty(selectedLevel);

    expect(result).toBe("3");
  });
});

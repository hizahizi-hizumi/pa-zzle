import { formatSolitaireProblemFeatures } from "@/games/solitaire/ui/problem-features";

describe("formatSolitaireProblemFeatures", () => {
  test("A の上の札と K の下の札を、0枚も含めて枚数で示すこと", () => {
    const features = formatSolitaireProblemFeatures({
      cardsAboveAce: 0,
      cardsBelowKing: 7,
    });

    expect(features).toEqual([
      { label: "A の上の札", value: "0枚" },
      { label: "K の下の札", value: "7枚" },
    ]);
  });
});

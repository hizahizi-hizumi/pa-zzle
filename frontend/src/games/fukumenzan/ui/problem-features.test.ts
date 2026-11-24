import { formatFukumenzanProblemFeatures } from "@/games/fukumenzan/ui/problem-features";

describe("formatFukumenzanProblemFeatures", () => {
  test("文字の種類と、同じ文字の桁の数を示すこと", () => {
    const features = formatFukumenzanProblemFeatures({
      letterCount: 7,
      sameLetterColumnCount: 3,
    });

    expect(features).toEqual([
      { label: "文字", value: "7種類" },
      { label: "同じ文字の桁", value: "3か所" },
    ]);
  });
});

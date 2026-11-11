import { render, screen, within } from "@testing-library/react";
import { ZukanProblemStatusCounts } from "@/zukan/ui/GameHomeScreen/ZukanProblemStatusCounts";

/** perfect と great と未挑戦だけに問題がある台紙。 */
const counts = {
  perfect: 3,
  great: 1,
  good: 0,
  clear: 0,
  attempted: 0,
  untouched: 6,
};

/** 状態ごとの数の一覧の項目の、目に見える文字。 */
function listShownTexts(): string[] {
  return within(screen.getByRole("list", { name: "状態ごとの問題の数" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("ZukanProblemStatusCounts", () => {
  describe("並べ方を渡さない場合", () => {
    beforeEach(() => {
      render(<ZukanProblemStatusCounts counts={counts} />);
    });

    test("数が0の状態も含めて、状態ごとの数を読み上げ名に持たせて並べること", () => {
      const names = within(
        screen.getByRole("list", { name: "状態ごとの問題の数" }),
      )
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("aria-label"));

      expect(names).toEqual([
        "perfect 3問",
        "great 1問",
        "good 0問",
        "clear 0問",
        "挑戦中 0問",
        "未挑戦 6問",
      ]);
    });

    test("状態の名前を添えず、数字だけを見せること", () => {
      const texts = listShownTexts();

      expect(texts).toEqual(["3", "1", "0", "0", "0", "6"]);
    });
  });

  describe("layout に list を渡した場合", () => {
    beforeEach(() => {
      render(<ZukanProblemStatusCounts counts={counts} layout="list" />);
    });

    test("数が0の状態も含めて、状態の名前を添えて数を見せること", () => {
      const texts = listShownTexts();

      expect(texts).toEqual([
        "perfect3",
        "great1",
        "good0",
        "clear0",
        "挑戦中0",
        "未挑戦6",
      ]);
    });
  });
});

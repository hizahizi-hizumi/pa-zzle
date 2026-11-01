import { formatTakuzuProblemFeatures } from "@/games/takuzu/ui/problem-features";

describe("formatTakuzuProblemFeatures", () => {
  test("初期配置のマスの数を示すこと", () => {
    const features = formatTakuzuProblemFeatures({ givenCount: 24 });

    expect(features).toEqual([{ label: "初期配置", value: "24マス" }]);
  });
});

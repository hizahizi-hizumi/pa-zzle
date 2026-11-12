import { listZukanLevelMosaicPaths } from "@/zukan/ui/GameHomeScreen/zukan-level-mosaic";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

describe("listZukanLevelMosaicPaths", () => {
  describe("同じ状態のマスが行の中で続き、行をまたいでも続く場合", () => {
    const columnCount = 3;
    const statuses: readonly ZukanProblemStatus[] = [
      "untouched",
      "untouched",
      "clear",
      "clear",
      "clear",
      "untouched",
      "attempted",
    ];

    test("同じ行で続くマスを1つの矩形にまとめ、行をまたいではまとめないこと", () => {
      const paths = listZukanLevelMosaicPaths(statuses, columnCount);

      expect(paths.get("untouched")).toBe("M0,0h2v1h-2zM2,1h1v1h-1z");
      expect(paths.get("clear")).toBe("M2,0h1v1h-1zM0,1h2v1h-2z");
      expect(paths.get("attempted")).toBe("M0,2h1v1h-1z");
    });

    test("マスの無い状態のパスを持たないこと", () => {
      const paths = listZukanLevelMosaicPaths(statuses, columnCount);

      expect([...paths.keys()].sort()).toEqual(
        ["attempted", "clear", "untouched"].sort(),
      );
    });
  });

  describe("問題が無い場合", () => {
    test("どの状態のパスも持たないこと", () => {
      const paths = listZukanLevelMosaicPaths([], 1);

      expect(paths.size).toBe(0);
    });
  });
});

import {
  hakoiriMusumeClassicLayout,
  parseHakoiriMusumeClassicBoard,
} from "@/games/hakoiri-musume/puzzle/classic-board";
import { parseHakoiriMusumeArrangement } from "@/games/hakoiri-musume/puzzle/notation";
import {
  findHakoiriMusumeElementHint,
  type HakoiriMusumeElementHintId,
} from "@/games/hakoiri-musume/ui/element-hints";

function arrangementOf(seed: string) {
  return parseHakoiriMusumeArrangement(seed)!;
}

const none = new Set<HakoiriMusumeElementHintId>();

describe("findHakoiriMusumeElementHint", () => {
  const twoTargets = "4x5;a..b/accb/BBde/fAAe/gAA.;bottom1-2@3.1;top1-2@0.1";

  describe("目標が2つの盤の場合", () => {
    const { layout, pieces } = arrangementOf(twoTargets);

    test("娘が2人の案内を出すこと", () => {
      const hint = findHakoiriMusumeElementHint(layout, pieces, none);

      expect(hint).toEqual({
        id: "two-targets",
        message: "娘が2人います。それぞれ同じ色の出口へ運びましょう。",
      });
    });

    test("一度出した案内は出さないこと", () => {
      const hint = findHakoiriMusumeElementHint(
        layout,
        pieces,
        new Set(["two-targets"]),
      );

      expect(hint).toBeNull();
    });
  });

  const withoutHint = [
    ["壁のある盤", "4x5;#a../bac./bAA./dAAe/ffg#;bottom1-2@3.1"],
    ["右の辺に出口がある盤", "4x5;aa.b/cAAb/.AAd/eefd/..fg;right1-2@1.2"],
    ["L字のある盤", "4x5;.ab./caAA/deAA/feeg/h.ig;bottom1-2@3.1"],
    ["出口が1マスの盤", "4x5;aa.b/aacc/.dA./eeA./ffgg;bottom1-1@3.1"],
    ["5 × 5 の盤", "5x5;.AAab/.AAab/c.def/cghif/jghk.;bottom1-3@3.1,3.2"],
  ] as const;

  test.each(withoutHint)(
    "見れば分かる要素には案内を出さないこと: %s",
    (_, seed) => {
      const { layout, pieces } = arrangementOf(seed);

      const hint = findHakoiriMusumeElementHint(layout, pieces, none);

      expect(hint).toBeNull();
    },
  );

  describe("基準の盤（4 × 5）の場合", () => {
    const pieces = parseHakoiriMusumeClassicBoard("vAAvwAAwv..vwhiws..s")!;

    test("案内を出さないこと", () => {
      const hint = findHakoiriMusumeElementHint(
        hakoiriMusumeClassicLayout,
        pieces,
        none,
      );

      expect(hint).toBeNull();
    });
  });
});

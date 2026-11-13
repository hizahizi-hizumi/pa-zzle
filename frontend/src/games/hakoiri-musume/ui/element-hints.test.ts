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
  const cases = [
    ["壁のある盤", "4x5;#a../bac./bAA./dAAe/ffg#;bottom1-2@3.1", "wall"],
    [
      "右の辺に出口がある盤",
      "4x5;aa.b/cAAb/.AAd/eefd/..fg;right1-2@1.2",
      "side-exit",
    ],
    ["L字のある盤", "4x5;.ab./caAA/deAA/feeg/h.ig;bottom1-2@3.1", "bend"],
    [
      "目標が2つの盤",
      "4x5;a..b/accb/BBde/fAAe/gAA.;bottom1-2@3.1;top1-2@0.1",
      "two-targets",
    ],
    [
      "出口が1マスの盤",
      "4x5;aa.b/aacc/.dA./eeA./ffgg;bottom1-1@3.1",
      "narrow-exit",
    ],
    [
      "5 × 5 の盤",
      "5x5;.AAab/.AAab/c.def/cghif/jghk.;bottom1-3@3.1,3.2",
      "large-board",
    ],
  ] as const;

  test.each(cases)(
    "まだ出していない要素の案内を出すこと: %s",
    (_, seed, expected) => {
      const { layout, pieces } = arrangementOf(seed);

      const hint = findHakoiriMusumeElementHint(layout, pieces, none);

      expect(hint?.id).toBe(expected);
    },
  );

  describe("一度出した要素の場合", () => {
    const { layout, pieces } = arrangementOf(
      "4x5;#a../bac./bAA./dAAe/ffg#;bottom1-2@3.1",
    );

    test("同じ案内を出さないこと", () => {
      const hint = findHakoiriMusumeElementHint(
        layout,
        pieces,
        new Set(["wall"]),
      );

      expect(hint).toBeNull();
    });
  });

  describe("初めての要素が2つある盤の場合", () => {
    // 目標が2つで、2つ目の目標の出口が1マス。
    const { layout, pieces } = arrangementOf(
      "4x5;Babb/AA.c/AAdd/.ee./ffgg;bottom1-2@3.1;top0-0@0.0",
    );

    test("先に出る要素の案内を1つだけ出すこと", () => {
      const hint = findHakoiriMusumeElementHint(layout, pieces, none);

      expect(hint?.id).toBe("two-targets");
    });
  });

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

import {
  formatHakoiriMusumeArrangement,
  parseHakoiriMusumeArrangement,
} from "@/games/hakoiri-musume/puzzle/notation";

describe("parseHakoiriMusumeArrangement", () => {
  describe("壁・L字・目標2つ・横の出口のある盤の場合", () => {
    // 目標 A（2×2）は右の出口の行1〜2へ、目標 B（横長）は上の出口の列1〜2へ運ぶ。
    const text = "4x5;#BB./aAA./.AAb/cc.b/d..#;right1-2@1.2;top1-2@0.1";

    test("盤の大きさ・壁・行き先と、最初のマスの順の駒を読むこと", () => {
      const parsed = parseHakoiriMusumeArrangement(text);

      expect(parsed).toEqual({
        layout: {
          columns: 4,
          rows: 5,
          walls: [0, 19],
          goals: [
            { placements: [6], exitSide: "right", exitCells: [7, 11] },
            { placements: [1], exitSide: "top", exitCells: [1, 2] },
          ],
        },
        pieces: [
          { kind: "horizontal", cell: 1, target: 1 },
          { kind: "small", cell: 4, target: null },
          { kind: "square", cell: 5, target: 0 },
          { kind: "vertical", cell: 11, target: null },
          { kind: "horizontal", cell: 12, target: null },
          { kind: "small", cell: 16, target: null },
        ],
      });
    });

    test("読んだ盤を書き戻すと同じ文字列になること", () => {
      const { layout, pieces } = parseHakoiriMusumeArrangement(text)!;

      const formatted = formatHakoiriMusumeArrangement(layout, pieces);

      expect(formatted).toBe(text);
    });
  });

  test("L字の形を、同じ文字のマスの並びから読むこと", () => {
    const parsed = parseHakoiriMusumeArrangement(
      "4x4;.a../aaAA/..AA/....;bottom2-3@2.2",
    );

    expect(parsed?.pieces[0]).toEqual({
      kind: "bend-up-left",
      cell: 0,
      target: null,
    });
  });

  const invalidCases = [
    ["行の数が高さと合わない", "4x4;..../..../....;bottom1-2@2.1"],
    ["行の長さが幅と合わない", "4x4;.../..../..../....;bottom1-2@2.1"],
    ["形の一覧に無い駒がある", "4x4;aaa./AA../AA../....;bottom0-1@2.0"],
    ["1つの文字が離れた2か所にある", "4x4;a..a/AA../AA../....;bottom0-1@2.0"],
    ["出口が盤の幅を越える", "4x4;..../AA../AA../....;bottom3-4@2.0"],
    ["出口の始めが終わりより後ろ", "4x4;..../AA../AA../....;bottom2-1@2.0"],
    ["知らない辺", "4x4;..../AA../AA../....;front0-1@2.0"],
  ] as const;

  test.each(invalidCases)("書き方に合わない文字列を拒むこと: %s", (_, text) => {
    const parsed = parseHakoiriMusumeArrangement(text);

    expect(parsed).toBeNull();
  });
});

import {
  formatNonogramPattern,
  getNonogramPatternLine,
  parseNonogramPattern,
} from "@/games/nonogram/puzzle/pattern";

describe("parseNonogramPattern", () => {
  test("`#` を黒、`.` を白として行優先で読むこと", () => {
    const pattern = parseNonogramPattern(["#.", ".#", "##"]);

    expect(pattern).toEqual({
      width: 2,
      height: 3,
      black: [true, false, false, true, true, true],
    });
  });

  test.each([
    ["幅のそろわない行", ["##", "#"]],
    ["盤面の記号", ["#x"]],
    ["行が無い", []],
  ])("%sを拒否すること", (_, rows) => {
    const act = () => parseNonogramPattern(rows);

    expect(act).toThrow(RangeError);
  });
});

describe("formatNonogramPattern", () => {
  const rows = ["#..#", "....", ".##."];

  test("読んだ記法に戻すこと", () => {
    const formatted = formatNonogramPattern(parseNonogramPattern(rows));

    expect(formatted).toEqual(rows);
  });
});

describe("getNonogramPatternLine", () => {
  const pattern = parseNonogramPattern(["#..", "##.", "..#"]);
  const cases = [
    ["行", { axis: "row", index: 1 }, [true, true, false]],
    ["列", { axis: "column", index: 0 }, [true, true, false]],
    ["右端の列", { axis: "column", index: 2 }, [false, false, true]],
  ] as const;

  test.each(cases)("%sの黒白を順に返すこと", (_, line, expected) => {
    const black = getNonogramPatternLine(pattern, line);

    expect(black).toEqual(expected);
  });
});

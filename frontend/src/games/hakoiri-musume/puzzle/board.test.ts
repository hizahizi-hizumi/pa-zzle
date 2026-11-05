import {
  formatHakoiriMusumeBoard,
  listHakoiriMusumePieceCells,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";

describe("parseHakoiriMusumeBoard", () => {
  describe("合意の易しい例の場合", () => {
    // vAAv
    // wAAw
    // v..v
    // whiw
    // s..s
    const text = "vAAvwAAwv..vwhiws..s";

    test("駒を左上のマスの順に読むこと", () => {
      const pieces = parseHakoiriMusumeBoard(text);

      expect(pieces).toEqual([
        { kind: "vertical", cell: 0 },
        { kind: "daughter", cell: 1 },
        { kind: "vertical", cell: 3 },
        { kind: "vertical", cell: 8 },
        { kind: "vertical", cell: 11 },
        { kind: "horizontal", cell: 13 },
        { kind: "small", cell: 16 },
        { kind: "small", cell: 19 },
      ]);
    });

    test("読んだ駒を書き戻すと同じ20文字になること", () => {
      const pieces = parseHakoiriMusumeBoard(text)!;

      const formatted = formatHakoiriMusumeBoard(pieces);

      expect(formatted).toBe(text);
    });
  });

  const invalidCases = [
    ["文字数が20でない", "vAAvwAAwv..vwhiws..", null],
    ["知らない文字がある", "vAAvwAAwv..vwhiws..x", null],
    ["縦長の下が欠けている", "vAAvwAAwv..vwhi.s..s", null],
    ["横長の右が欠けている", "vAAvwAAwv..vwh.ws..s", null],
    ["娘が2×2の形でない", "vAAvwA.wv..vwhiws..s", null],
    ["縦長が下の端からはみ出す", "vAAvwAAwv..vwhiwvs.s", null],
    ["横長が右の端で折り返す", "vAAvwAAwv..vwhiw...h", null],
    ["縦長の下だけがある", "wAAvwAAwv..vwhiws..s", null],
  ] as const;

  test.each(invalidCases)(
    "駒の形として読めない盤面を拒むこと: %s",
    (_, text, expected) => {
      const pieces = parseHakoiriMusumeBoard(text);

      expect(pieces).toBe(expected);
    },
  );
});

describe("listHakoiriMusumePieceCells", () => {
  const cases = [
    ["娘", { kind: "daughter", cell: 1 }, [1, 2, 5, 6]],
    ["縦長", { kind: "vertical", cell: 3 }, [3, 7]],
    ["横長", { kind: "horizontal", cell: 13 }, [13, 14]],
    ["小駒", { kind: "small", cell: 19 }, [19]],
  ] as const;

  test.each(cases)("駒の形どおりのマスを覆うこと: %s", (_, piece, expected) => {
    const cells = listHakoiriMusumePieceCells(piece);

    expect(cells).toEqual(expected);
  });
});

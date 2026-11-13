import {
  assertHakoiriMusumeProblem,
  createHakoiriMusumeProblemIdentity,
  HAKOIRI_MUSUME_GENERATOR_VERSION,
  isCurrentHakoiriMusumeProblemIdentity,
  isHakoiriMusumeRecordedProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import {
  hakoiriMusumeClassicLayout,
  parseHakoiriMusumeClassicBoard,
} from "@/games/hakoiri-musume/puzzle/classic-board";
import { parseHakoiriMusumeArrangement } from "@/games/hakoiri-musume/puzzle/notation";

const easyBoard = "vAAvwAAwv..vwhiws..s";
const layout = hakoiriMusumeClassicLayout;
const easyProblem = {
  layout,
  pieces: parseHakoiriMusumeClassicBoard(easyBoard)!,
};

/** 壁・目標2つ・横の出口のある 4 × 5 の盤。 */
const variantBoard = "4x5;#BB./aAA./.AAb/cc.b/d..#;right1-2@1.2;top1-2@0.1";

describe("createHakoiriMusumeProblemIdentity", () => {
  test("盤面の20文字を seed にすること", () => {
    const identity = createHakoiriMusumeProblemIdentity(easyBoard);

    expect(identity).toEqual({
      generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
      seed: easyBoard,
      conditions: {},
    });
  });
});

describe("restoreHakoiriMusumeProblem", () => {
  const identity = createHakoiriMusumeProblemIdentity(easyBoard);

  test("identity の盤面から、基準の盤の同じ駒の並びを読むこと", () => {
    const { problem } = restoreHakoiriMusumeProblem(identity);

    expect(problem).toEqual(easyProblem);
  });

  test("盤の作りを含めた書き方の identity から、その盤の問題を読むこと", () => {
    const { problem } = restoreHakoiriMusumeProblem(
      createHakoiriMusumeProblemIdentity(variantBoard),
    );

    expect(problem).toEqual(parseHakoiriMusumeArrangement(variantBoard));
  });
});

describe("assertHakoiriMusumeProblem", () => {
  const invalidCases = [
    [
      "娘が無い",
      {
        layout,
        pieces: parseHakoiriMusumeClassicBoard("vssvwsswv..vwhiws..s")!,
      },
    ],
    [
      "娘が出口の前から始まる",
      {
        layout,
        pieces: parseHakoiriMusumeClassicBoard("v..vwssw.hi.vAAvwAAw")!,
      },
    ],
    [
      "駒が重なる",
      {
        layout,
        pieces: [
          { kind: "square", cell: 1, target: 0 },
          { kind: "small", cell: 2, target: null },
        ],
      },
    ],
    [
      "駒が箱からはみ出す",
      {
        layout,
        pieces: [
          { kind: "square", cell: 1, target: 0 },
          { kind: "horizontal", cell: 19, target: null },
        ],
      },
    ],
    [
      "駒が左上のマスの順に並んでいない",
      {
        layout,
        pieces: [
          { kind: "small", cell: 19, target: null },
          { kind: "square", cell: 1, target: 0 },
        ],
      },
    ],
    [
      "駒が壁に重なる",
      {
        layout: { ...layout, walls: [0] },
        pieces: [
          { kind: "small", cell: 0, target: null },
          { kind: "square", cell: 1, target: 0 },
        ],
      },
    ],
    [
      "盤が3マス幅",
      {
        layout: { ...layout, columns: 3 },
        pieces: [{ kind: "square", cell: 0, target: 0 }],
      },
    ],
    [
      "盤が7マス高い",
      {
        layout: { ...layout, rows: 7 },
        pieces: [{ kind: "square", cell: 1, target: 0 }],
      },
    ],
    [
      "行き先の数と目標の駒の数が合わない",
      {
        layout: {
          ...layout,
          goals: [...layout.goals, { ...layout.goals[0], placements: [0] }],
        },
        pieces: [{ kind: "square", cell: 1, target: 0 }],
      },
    ],
    [
      "出口が盤の端に面していない",
      {
        layout: {
          ...layout,
          goals: [{ ...layout.goals[0], exitCells: [13, 14] }],
        },
        pieces: [{ kind: "square", cell: 1, target: 0 }],
      },
    ],
  ] as const;

  test.each(invalidCases)(
    "問題として成り立たない並びを拒むこと: %s",
    (_, problem) => {
      const act = () => assertHakoiriMusumeProblem(problem);

      expect(act).toThrow(RangeError);
    },
  );

  test("易しい例を受け付けること", () => {
    const act = () => assertHakoiriMusumeProblem(easyProblem);

    expect(act).not.toThrow();
  });

  test("壁・目標2つ・横の出口のある盤を受け付けること", () => {
    const act = () =>
      assertHakoiriMusumeProblem(parseHakoiriMusumeArrangement(variantBoard)!);

    expect(act).not.toThrow();
  });
});

describe("isCurrentHakoiriMusumeProblemIdentity", () => {
  const cases = [
    ["今の版の易しい例", createHakoiriMusumeProblemIdentity(easyBoard), true],
    [
      "盤の作りを含めた書き方",
      createHakoiriMusumeProblemIdentity(variantBoard),
      true,
    ],
    [
      "基準の盤を盤の作りを含めた書き方で書いた",
      createHakoiriMusumeProblemIdentity(
        "4x5;aAAb/aAAb/c..d/ceed/f..g;bottom1-2@3.1",
      ),
      false,
    ],
    [
      "駒の文字が最初のマスの順でない",
      createHakoiriMusumeProblemIdentity(
        "4x5;#BB./bAA./.AAa/cc.a/d..#;right1-2@1.2;top1-2@0.1",
      ),
      false,
    ],
    [
      "別の版",
      { generatorVersion: "0", seed: easyBoard, conditions: {} },
      false,
    ],
    [
      "読めない盤面",
      {
        generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
        seed: "vAAv",
        conditions: {},
      },
      false,
    ],
    [
      "生成条件を持つ",
      {
        generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
        seed: easyBoard,
        conditions: { width: 4 },
      },
      false,
    ],
  ] as const;

  test.each(cases)(
    "今の生成器で復元できるかを確かめること: %s",
    (_, value, expected) => {
      const accepted = isCurrentHakoiriMusumeProblemIdentity(value);

      expect(accepted).toBe(expected);
    },
  );
});

describe("isHakoiriMusumeRecordedProblemIdentity", () => {
  const otherVersion = { generatorVersion: "0", seed: "old", conditions: {} };

  test("別の版の identity も記録の識別情報として読むこと", () => {
    const accepted = isHakoiriMusumeRecordedProblemIdentity(otherVersion);

    expect(accepted).toBe(true);
  });
});

import {
  assertHakoiriMusumeProblem,
  createHakoiriMusumeProblemIdentity,
  HAKOIRI_MUSUME_GENERATOR_VERSION,
  isHakoiriMusumeProblemIdentity,
  isHakoiriMusumeRecordedProblemIdentity,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

const easyBoard = "vAAvwAAwv..vwhiws..s";
const easyProblem = { pieces: parseHakoiriMusumeBoard(easyBoard)! };

describe("createHakoiriMusumeProblemIdentity", () => {
  test("盤面の20文字を seed にすること", () => {
    const identity = createHakoiriMusumeProblemIdentity(easyProblem);

    expect(identity).toEqual({
      generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
      seed: easyBoard,
      conditions: {},
    });
  });
});

describe("restoreHakoiriMusumeProblem", () => {
  const identity = createHakoiriMusumeProblemIdentity(easyProblem);

  test("identity の盤面から同じ駒の並びを読むこと", () => {
    const { problem } = restoreHakoiriMusumeProblem(identity);

    expect(problem).toEqual(easyProblem);
  });
});

describe("assertHakoiriMusumeProblem", () => {
  const invalidCases = [
    ["娘が無い", { pieces: parseHakoiriMusumeBoard("vssvwsswv..vwhiws..s")! }],
    [
      "娘が出口の前から始まる",
      { pieces: parseHakoiriMusumeBoard("v..vwssw.hi.vAAvwAAw")! },
    ],
    [
      "駒が重なる",
      {
        pieces: [
          { kind: "daughter", cell: 1 },
          { kind: "small", cell: 2 },
        ],
      },
    ],
    [
      "駒が箱からはみ出す",
      {
        pieces: [
          { kind: "daughter", cell: 1 },
          { kind: "horizontal", cell: 19 },
        ],
      },
    ],
    [
      "駒が左上のマスの順に並んでいない",
      {
        pieces: [
          { kind: "small", cell: 19 },
          { kind: "daughter", cell: 1 },
        ],
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

  test("合意の易しい例を受け付けること", () => {
    const act = () => assertHakoiriMusumeProblem(easyProblem);

    expect(act).not.toThrow();
  });
});

describe("isHakoiriMusumeProblemIdentity", () => {
  const cases = [
    ["今の版の易しい例", createHakoiriMusumeProblemIdentity(easyProblem), true],
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
      const accepted = isHakoiriMusumeProblemIdentity(value);

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

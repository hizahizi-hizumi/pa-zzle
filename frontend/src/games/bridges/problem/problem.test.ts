import {
  createBridgesProblemIdentity,
  isBridgesProblemIdentity,
  isBridgesRecordedProblemIdentity,
} from "@/games/bridges/problem/problem";

describe("createBridgesProblemIdentity", () => {
  test("生成条件の割合を百分率の整数で、磨く回数をそのまま seed に含めること", () => {
    const identity = createBridgesProblemIdentity(
      {
        size: 10,
        islandDensity: 0.26,
        doubleBridgeRate: 0.65,
        extraBridgeRate: 0.25,
        splitRate: 0.45,
        refinementSteps: 500,
        refinementGoal: "lookahead",
        layoutSymmetry: "none",
      },
      3,
    );

    expect(identity).toEqual({
      generatorVersion: "9",
      seed: "br-10-d26-p65-e25-s45-r500-lookahead-3",
      conditions: {
        size: 10,
        islandDensity: 0.26,
        doubleBridgeRate: 0.65,
        extraBridgeRate: 0.25,
        splitRate: 0.45,
        refinementSteps: 500,
        refinementGoal: "lookahead",
        layoutSymmetry: "none",
      },
    });
  });
});

describe("isBridgesProblemIdentity", () => {
  const identity = createBridgesProblemIdentity(
    {
      size: 7,
      islandDensity: 0.26,
      doubleBridgeRate: 0.5,
      extraBridgeRate: 0.45,
      splitRate: 0.2,
      refinementSteps: 0,
      refinementGoal: "lookahead",
      layoutSymmetry: "none",
    },
    0,
  );

  test.each([
    ["今の生成器の identity", identity, true],
    [
      "扱わない盤面の大きさ",
      { ...identity, conditions: { ...identity.conditions, size: 11 } },
      false,
    ],
    [
      "扱わない2本の割合",
      {
        ...identity,
        conditions: { ...identity.conditions, doubleBridgeRate: 0.1 },
      },
      false,
    ],
    [
      "扱わない磨く回数",
      {
        ...identity,
        conditions: { ...identity.conditions, refinementSteps: 100 },
      },
      false,
    ],
    ["別の生成器の版", { ...identity, generatorVersion: "0" }, false],
    ["空の seed", { ...identity, seed: "" }, false],
  ])("%sに %s を返すこと", (_, value, expected) => {
    const result = isBridgesProblemIdentity(value);

    expect(result).toBe(expected);
  });

  describe("別の生成器の版の記録の場合", () => {
    const recorded = { ...identity, generatorVersion: "0" };

    test("記録の identity としては読めること", () => {
      const result = isBridgesRecordedProblemIdentity(recorded);

      expect(result).toBe(true);
    });
  });
});

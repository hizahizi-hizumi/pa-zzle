import {
  createBridgesProblemIdentity,
  isBridgesProblemIdentity,
  isBridgesRecordedProblemIdentity,
} from "@/games/bridges/problem/problem";

describe("createBridgesProblemIdentity", () => {
  test("生成条件を百分率の整数で seed に含めること", () => {
    const identity = createBridgesProblemIdentity(
      {
        size: 10,
        islandDensity: 0.3,
        doubleBridgeRate: 0.1,
        extraBridgeRate: 0.15,
        splitRate: 0.2,
      },
      3,
    );

    expect(identity).toEqual({
      generatorVersion: "3",
      seed: "br-10-d30-p10-e15-s20-3",
      conditions: {
        size: 10,
        islandDensity: 0.3,
        doubleBridgeRate: 0.1,
        extraBridgeRate: 0.15,
        splitRate: 0.2,
      },
    });
  });
});

describe("isBridgesProblemIdentity", () => {
  const identity = createBridgesProblemIdentity(
    {
      size: 7,
      islandDensity: 0.24,
      doubleBridgeRate: 0.2,
      extraBridgeRate: 0,
      splitRate: 0,
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
        conditions: { ...identity.conditions, doubleBridgeRate: 0.5 },
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

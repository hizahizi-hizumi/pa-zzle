import {
  analyzeRuleLab,
  applyRuleLabExit,
  createRuleLabState,
  getRuleLabScenario,
  isRuleLabStuck,
  isRuleLabWon,
  type RuleLabColor,
  type RuleLabScenario,
} from "@/games/parking-jam/rule-lab/rule-lab";

describe("Parking Jam gameplay rule comparison (#727)", () => {
  test("現行の可解な盤面は合法な初手で失敗しないこと", () => {
    const scenario = getRuleLabScenario("standard");
    const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
    expect(result.exits).toHaveLength(5);
    expect(result.exits.every((exit) => exit.canWin)).toBe(true);
    expect(result.totalWinningSequences).toBe(10304);
  });

  test("同色ペアの有限待機枠では合法な初手5つのうち2つが失敗すること", () => {
    const scenario = getRuleLabScenario("pairs");
    const state = createRuleLabState(scenario);
    const result = analyzeRuleLab(scenario, state);
    expect(result.exits).toEqual([
      { vehicleId: "v2", canWin: true },
      { vehicleId: "v3", canWin: false },
      { vehicleId: "v4", canWin: true },
      { vehicleId: "v5", canWin: false },
      { vehicleId: "v7", canWin: true },
    ]);
    expect(result.totalWinningSequences).toBe(96);
    const bad = applyRuleLabExit(scenario, state, "v3");
    expect(bad).not.toBeNull();
    expect(bad && isRuleLabWon(scenario, bad)).toBe(false);
  });

  test("定員付き乗客列では合法な初手5つのうち1つが失敗すること", () => {
    const scenario = getRuleLabScenario("passengers");
    const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
    expect(result.exits).toEqual([
      { vehicleId: "v2", canWin: true },
      { vehicleId: "v3", canWin: true },
      { vehicleId: "v4", canWin: false },
      { vehicleId: "v5", canWin: true },
      { vehicleId: "v7", canWin: true },
    ]);
    expect(result.totalWinningSequences).toBe(372);
  });

  test("枠が満杯なら出庫を拒否し、待ったなしでは詰むこと", () => {
    const scenario = getRuleLabScenario("pairs");
    let state = createRuleLabState(scenario);
    for (const vehicleId of ["v3", "v2"]) {
      const next = applyRuleLabExit(scenario, state, vehicleId);
      expect(next).not.toBeNull();
      if (next) state = next;
    }
    expect(isRuleLabStuck(scenario, state)).toBe(true);
    expect(applyRuleLabExit(scenario, state, "v4")).toBeNull();
  });
});

describe("比較試作の通し解", () => {
  test.each(["standard", "pairs", "passengers", "dispatch"] as const)(
    "%sは解けるだけでなく一手ずつ完走できること",
    (mode) => {
      const scenario = getRuleLabScenario(mode);
      let state = createRuleLabState(scenario);
      let choices = 0;
      while (
        !isRuleLabWon(scenario, state) &&
        choices < scenario.board.vehicles.length
      ) {
        const safeExit = analyzeRuleLab(scenario, state).exits.find(
          ({ canWin }) => canWin,
        );
        expect(safeExit).toBeDefined();
        if (!safeExit) break;
        const next = applyRuleLabExit(scenario, state, safeExit.vehicleId);
        expect(next).not.toBeNull();
        if (!next) break;
        state = next;
        choices += 1;
      }
      expect(choices).toBe(scenario.board.vehicles.length);
      expect(isRuleLabWon(scenario, state)).toBe(true);
    },
  );
});

describe("12台構成での比較", () => {
  test.each([
    { mode: "standard", total: 11347300, bad: 0 },
    { mode: "pairs", total: 448, bad: 3 },
    { mode: "passengers", total: 3816, bad: 3 },
    { mode: "dispatch", total: 5556, bad: 1 },
  ] as const)(
    "$modeの全探索結果が独立モデルと一致すること",
    ({ mode, total, bad }) => {
      const scenario = getRuleLabScenario(mode, "large");
      const result = analyzeRuleLab(scenario, createRuleLabState(scenario));

      expect(result.totalWinningSequences).toBe(total);
      expect(result.exits.filter(({ canWin }) => !canWin)).toHaveLength(bad);
    },
  );

  test.each(["standard", "pairs", "passengers", "dispatch"] as const)(
    "%sは12台を順に出庫してクリアできること",
    (mode) => {
      const scenario = getRuleLabScenario(mode, "large");
      let state = createRuleLabState(scenario);
      for (let i = 0; i < 12; i += 1) {
        const safe = analyzeRuleLab(scenario, state).exits.find(
          ({ canWin }) => canWin,
        );
        expect(safe).toBeDefined();
        if (!safe) break;
        state = applyRuleLabExit(scenario, state, safe.vehicleId) ?? state;
      }

      expect(isRuleLabWon(scenario, state)).toBe(true);
    },
  );
});

describe("同色ペアの3枠構成", () => {
  test.each(["small", "large"] as const)(
    "%sでは初手の正誤だけでなく途中局面の判断が生じること",
    (size) => {
      const scenario = getRuleLabScenario("pairs", size, 3);
      const initial = createRuleLabState(scenario);
      const first = analyzeRuleLab(scenario, initial);
      expect(first.exits.every(({ canWin }) => canWin)).toBe(true);

      let frontier = [initial];
      let hasLosingDecision = false;
      for (let depth = 0; depth <= 2 && !hasLosingDecision; depth += 1) {
        const nextFrontier = [];
        for (const state of frontier) {
          const result = analyzeRuleLab(scenario, state);
          if (
            result.exits.some(({ canWin }) => canWin) &&
            result.exits.some(({ canWin }) => !canWin)
          ) {
            hasLosingDecision = true;
            break;
          }
          for (const { vehicleId, canWin } of result.exits) {
            if (!canWin) continue;
            const next = applyRuleLabExit(scenario, state, vehicleId);
            if (next) nextFrontier.push(next);
          }
        }
        frontier = nextFrontier;
      }
      expect(hasLosingDecision).toBe(true);
    },
  );
});

describe("比較の前提条件", () => {
  test.each(["small", "large"] as const)(
    "%sの3方式は車両配置と色が一致すること",
    (size) => {
      const baseline = getRuleLabScenario("standard", size);
      const pair = getRuleLabScenario("pairs", size);
      const passengers = getRuleLabScenario("passengers", size);
      const dispatch = getRuleLabScenario("dispatch", size);

      expect(pair.board).toEqual(baseline.board);
      expect(passengers.board).toEqual(baseline.board);
      expect(dispatch.board).toEqual(baseline.board);
      expect(pair.colors).toEqual(baseline.colors);
      expect(passengers.colors).toEqual(baseline.colors);
      expect(dispatch.colors).toEqual(baseline.colors);
    },
  );

  test.each(["small", "large"] as const)(
    "%sの乗客列が全車の定員を過不足なく満たすこと",
    (size) => {
      const scenario = getRuleLabScenario("passengers", size);
      const actual = new Map<RuleLabColor, number>();
      const expected = new Map<RuleLabColor, number>();
      for (const color of scenario.queue) {
        actual.set(color, (actual.get(color) ?? 0) + 1);
      }
      for (const [index, vehicle] of scenario.board.vehicles.entries()) {
        const color = scenario.colors[index];
        if (color)
          expected.set(color, (expected.get(color) ?? 0) + vehicle.length);
      }

      expect(actual).toEqual(expected);
    },
  );
});

describe("出庫指令の待機枠数の比較", () => {
  test.each([
    { size: "small", bays: 4, total: 2010, bad: 0 },
    { size: "small", bays: 5, total: 4272, bad: 0 },
    { size: "large", bays: 4, total: 664876, bad: 0 },
    { size: "large", bays: 5, total: 1829719, bad: 0 },
  ] as const)(
    "$size / $bays 枠の全探索が独立した研究モデルと一致すること",
    ({ size, bays, total, bad }) => {
      const scenario = getRuleLabScenario("dispatch", size, bays);
      const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
      expect(scenario.bayCount).toBe(bays);
      expect(result.totalWinningSequences).toBe(total);
      expect(result.exits.filter(({ canWin }) => !canWin)).toHaveLength(bad);
    },
  );
});

describe("同色ペアの余剰待機枠の比較", () => {
  test.each([
    { size: "small", bays: 4, total: 8096 },
    { size: "small", bays: 5, total: 10304 },
    { size: "large", bays: 4, total: 2041592 },
    { size: "large", bays: 5, total: 6588404 },
  ] as const)(
    "$size / $bays 枠で正解順数が独立モデルと一致すること",
    ({ size, bays, total }) => {
      const scenario = getRuleLabScenario("pairs", size, bays);
      const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
      expect(result.totalWinningSequences).toBe(total);
    },
  );
});

describe("複数の同色車が待機している場合", () => {
  const scenario: RuleLabScenario = {
    board: {
      width: 5,
      height: 5,
      vehicles: [
        { id: "v0", row: 0, column: 0, orientation: "horizontal", length: 2 },
        { id: "v1", row: 1, column: 0, orientation: "horizontal", length: 2 },
        { id: "v2", row: 2, column: 0, orientation: "horizontal", length: 2 },
      ],
      fixedAreas: [],
      roadOpenings: [{ side: "left", startOffset: 0, length: 3 }],
    },
    colors: ["A", "A", "B"],
    mode: "passengers",
    queue: ["A", "A", "A", "A", "B", "B"],
    bayCount: 3,
  };
  const firstArrival = {
    remainingVehicleIds: ["v2"],
    waiting: [
      { vehicleId: "v0", boarded: 0 },
      { vehicleId: "v1", boarded: 0 },
    ],
    nextPassengerIndex: 0,
    departedVehicleIds: [],
  };
  const reversedArrival = {
    ...firstArrival,
    waiting: [...firstArrival.waiting].reverse(),
  };

  test("待機枠への到着順に乗客を割り当てること", () => {
    const first = applyRuleLabExit(scenario, firstArrival, "v2");
    const reversed = applyRuleLabExit(scenario, reversedArrival, "v2");

    expect(first?.departedVehicleIds.slice(0, 2)).toEqual(["v0", "v1"]);
    expect(reversed?.departedVehicleIds.slice(0, 2)).toEqual(["v1", "v0"]);
  });
});

describe("出庫指令型の独立探索との照合", () => {
  test.each([
    { size: "small", bays: 2, total: 42, losing: 3 },
    { size: "small", bays: 3, total: 512, losing: 0 },
    { size: "large", bays: 2, total: 5556, losing: 1 },
    { size: "large", bays: 3, total: 141836, losing: 0 },
  ] as const)(
    "$sizeの$bays枠はクリア順と初手の詰みが独立モデルに一致すること",
    ({ size, bays, total, losing }) => {
      const scenario = getRuleLabScenario("dispatch", size, bays);
      const result = analyzeRuleLab(scenario, createRuleLabState(scenario));
      expect(result.totalWinningSequences).toBe(total);
      expect(result.exits.filter(({ canWin }) => !canWin)).toHaveLength(losing);
      expect(scenario.queue).toHaveLength(scenario.board.vehicles.length);
    },
  );

  test.each(["small", "large"] as const)(
    "$sizeの指令は全車の色を過不足なく含むこと",
    (size) => {
      const scenario = getRuleLabScenario("dispatch", size);
      const count = (values: readonly RuleLabColor[]) =>
        Object.entries(
          values.reduce<Record<string, number>>((counts, color) => {
            counts[color] = (counts[color] ?? 0) + 1;
            return counts;
          }, {}),
        ).sort();
      expect(count(scenario.queue)).toEqual(count(scenario.colors));
    },
  );
});

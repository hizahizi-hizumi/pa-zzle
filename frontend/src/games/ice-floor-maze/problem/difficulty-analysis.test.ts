// @vitest-environment node

import { analyzeIceFloorMazeDifficulty } from "@/games/ice-floor-maze/problem/difficulty-analysis";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";

describe("analyzeIceFloorMazeDifficulty", () => {
  describe("研究用の生成 v4 の試遊候補の場合", () => {
    // docs/パズル/導入調査/氷の床迷路/作り直し資料/試遊ページv4.html の w01・w02。期待値は
    // scripts/research/ice_floor_hardest_generation_experiment.py の候補の特徴量（難しさは状態の読み深さを含む）。
    const candidates = [
      {
        name: "w01（もろい岩）",
        problem: {
          board: parseIceFloorMazeBoard([
            ".....#..",
            "..##b...",
            "..##..b#",
            "#...b..#",
            "#b.....b",
            "###.#..#",
            ".....b.#",
            ".#....b#",
          ]),
          start: 38,
          goal: 14,
        },
        expected: {
          composition: "brittle-rock",
          features: {
            optimalMoveCount: 14,
            optimalSolutionCount: 1,
            reachableStateCount: 928,
            deadStateCount: 901,
            elementCount: 7,
            brittleRockCount: 7,
            thinIceCount: 0,
            decoyCount: 2,
            weakDecoyCount: 0,
            useCount: 6,
            orderDependencyCount: 10,
            orderChain: 5,
            orderTrapCount: 4,
            lureCount: 7,
            looksReading: "misleading",
            stateReadingDepth: 7,
          },
          hardness: 50.8,
        },
      },
      {
        name: "w02（薄い氷）",
        problem: {
          board: parseIceFloorMazeBoard([
            "##.....#",
            "....c...",
            ".c......",
            "#....#.c",
            "#c.cc.#.",
            ".c....##",
            "##......",
            "#..#.###",
          ]),
          start: 20,
          goal: 42,
        },
        expected: {
          composition: "thin-ice",
          features: {
            optimalMoveCount: 15,
            optimalSolutionCount: 1,
            reachableStateCount: 327,
            deadStateCount: 212,
            elementCount: 7,
            brittleRockCount: 0,
            thinIceCount: 7,
            decoyCount: 2,
            weakDecoyCount: 0,
            useCount: 6,
            orderDependencyCount: 8,
            orderChain: 4,
            orderTrapCount: 4,
            lureCount: 7,
            looksReading: "unsolvable",
            stateReadingDepth: 8,
          },
          hardness: 52.3,
        },
      },
    ] as const;

    test.each(candidates)(
      "$name の要素の種類と特徴が研究用と一致すること",
      ({ problem, expected }) => {
        const analysis = analyzeIceFloorMazeDifficulty(problem);

        expect(analysis).toMatchObject({
          status: "analyzed",
          composition: expected.composition,
          features: expected.features,
        });
        expect(
          analysis.status === "analyzed" &&
            analysis.composition !== "none" &&
            Number(analysis.features.hardness.toFixed(1)),
        ).toBe(expected.hardness);
      },
    );
  });

  describe("研究用の生成 v2 の試遊候補 q12（氷と岩だけ）の場合", () => {
    // 期待値は scripts/research/ice_floor_tactic_generation_experiment.py の候補の特徴量。
    const problem = {
      board: parseIceFloorMazeBoard([
        "#.##......",
        "...##.....",
        "..#.....#.",
        "...#...##.",
        "..#....#.#",
        ".....##...",
        "....#.....",
        ".#...#....",
        "..##......",
        ".....#....",
      ]),
      start: 8,
      goal: 7,
    };

    test("手筋のタグ・読み深さ・近い別解・到達できる停止点が研究用と一致すること", () => {
      const analysis = analyzeIceFloorMazeDifficulty(problem);

      expect(analysis).toMatchObject({
        status: "analyzed",
        composition: "none",
        features: {
          optimalMoveCount: 11,
          optimalSolutionCount: 1,
          forcedMoveCount: 0,
          reachableStopCount: 26,
          deadStopCount: 3,
          tags: [
            "pass-lure",
            "reentry",
            "trap-lure",
            "pass-trap",
            "detour",
            "backward-funnel",
            "fork",
          ],
          readingDepth: 4,
          nearPathCount: 22,
        },
      });
    });
  });

  describe("ゴールへ止まれない問題の場合", () => {
    const problem = {
      board: parseIceFloorMazeBoard(["...", ".#.", "..."]),
      start: 0,
      goal: 1,
    };

    test("問題として成立しないと判定すること", () => {
      const analysis = analyzeIceFloorMazeDifficulty(problem);

      expect(analysis).toEqual({
        status: "invalid",
        reason: "goal-unreachable",
        shape: { width: 3, height: 3 },
      });
    });
  });
});

import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  getClearWaveTiming,
  listClearWaveDepths,
} from "@/games/bridges/ui/board/clear-wave";

describe("listClearWaveDepths", () => {
  // 島: 0 (0,0)、1 (0,4)、2 (4,0)、3 (4,4)。辺0 = 0-1、辺1 = 0-2、辺2 = 1-3、辺3 = 2-3。
  const board = parseBridgesBoard([
    "3...3",
    ".....",
    ".....",
    ".....",
    "2...2",
  ]);

  test("島0 から架かった橋をたどった段数を返すこと", () => {
    const depths = listClearWaveDepths(board, [2, 1, 1, 0]);

    expect(depths).toEqual([0, 1, 1, 2]);
  });

  test("橋でたどれない島には null を返すこと", () => {
    const depths = listClearWaveDepths(board, [1, 0, 0, 0]);

    expect(depths).toEqual([0, 1, null, null]);
  });
});

describe("getClearWaveTiming", () => {
  // 島0 から右へ1列に並んだ11島。橋をたどると最も遠い島は10段目。
  const chain = parseBridgesBoard(["1.2.2.2.2.2.2.2.2.2.1"]);
  const chainBridges = Array.from({ length: 10 }, (): BridgeCount => 1);
  const square = parseBridgesBoard([
    "3...3",
    ".....",
    ".....",
    ".....",
    "2...2",
  ]);

  test("段の少ない盤面では、島0 が灯ってから1段ごとに100ミリ秒で次の段を灯すこと", () => {
    const timing = getClearWaveTiming(square, [2, 1, 1, 0]);

    expect(timing).toEqual({
      depthStartMs: [160, 260, 360],
      seaLitMs: 504,
    });
  });

  test("段の多い盤面では、最も遠い段が灯り始めるまでを700ミリ秒に収めること", () => {
    const timing = getClearWaveTiming(chain, chainBridges);

    expect(timing.depthStartMs).toHaveLength(11);
    expect(timing.depthStartMs.at(-1)).toBe(860);
    expect(timing.seaLitMs).toBe(1004);
  });
});

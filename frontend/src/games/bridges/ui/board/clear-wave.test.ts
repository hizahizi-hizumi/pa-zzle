import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { getBridgeExtendMs } from "@/games/bridges/ui/board/bridge-extend";
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

  test("最後に架けた橋を渡すと、その両端の島から数えた段数を返すこと", () => {
    const depths = listClearWaveDepths(board, [2, 1, 1, 1], 3);

    expect(depths).toEqual([1, 1, 0, 0]);
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

  test("段の少ない盤面では、最初の段が弾んでから1段ごとに120ミリ秒で次の段へ光を渡すこと", () => {
    const timing = getClearWaveTiming(square, [2, 1, 1, 0]);

    expect(timing).toEqual({
      depthStartMs: [80, 200, 320],
      stepMs: 120,
      allLitMs: 464,
    });
  });

  test("段の多い盤面では、最も遠い段に光が着くまでを720ミリ秒の広がりに収めること", () => {
    const timing = getClearWaveTiming(chain, chainBridges);

    expect(timing.depthStartMs).toHaveLength(11);
    expect(timing.stepMs).toBe(72);
    expect(timing.depthStartMs.at(-1)).toBe(800);
    expect(timing.allLitMs).toBe(944);
  });

  test("最後に架けた橋を渡すと、その板が相手の島に着いてから両端の島を弾ませること", () => {
    const timing = getClearWaveTiming(square, [2, 1, 1, 1], 3);

    expect(timing.depthStartMs[0]).toBe(getBridgeExtendMs(square, 3) + 40);
  });

  test("最後に架けた橋を渡すと、その両端から数えて段の数を少なくすること", () => {
    const timing = getClearWaveTiming(chain, chainBridges, 4);

    expect(timing.depthStartMs).toHaveLength(6);
  });
});

import { _private } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/play-clear-trace";

const { getClearTraceDurationMs } = _private;

describe("getClearTraceDurationMs", () => {
  const cases = [
    ["短い道は下限", 10, 640],
    ["中くらいの道はマス数に比例", 40, 1_120],
    ["長い道は上限", 64, 1_400],
  ] as const;

  test.each(cases)("%sの長さになること", (_, cellCount, expected) => {
    const durationMs = getClearTraceDurationMs(cellCount);

    expect(durationMs).toBe(expected);
  });
});

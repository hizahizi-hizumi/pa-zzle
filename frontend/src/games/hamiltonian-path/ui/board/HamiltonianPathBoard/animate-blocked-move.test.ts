import { _private } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/animate-blocked-move";

const { createHeadShakeKeyframes, findBlockingPartitionKey } = _private;

describe("createHeadShakeKeyframes", () => {
  test("進もうとした向きへ突き当たってから戻ること", () => {
    const keyframes = createHeadShakeKeyframes("down");

    expect(keyframes[1]).toEqual({ transform: "translate(0px, 0.14px)" });
    expect(keyframes.at(-1)).toEqual({ transform: "translate(0px, 0px)" });
  });

  test("向きが無ければ左右に揺れること", () => {
    const keyframes = createHeadShakeKeyframes(null);

    expect(keyframes.map(({ transform }) => transform)).toEqual([
      "translate(0px, 0px)",
      "translate(-0.08px, 0px)",
      "translate(0.08px, 0px)",
      "translate(-0.04px, 0px)",
      "translate(0px, 0px)",
    ]);
  });
});

describe("findBlockingPartitionKey", () => {
  const cases = [
    ["仕切りに阻まれた右向き", "partition", "right", "4-5"],
    ["仕切りに阻まれた上向き", "partition", "up", "1-4"],
    ["壁マスに阻まれた向き", "wall", "right", null],
    ["向きの無い拒否", "partition", null, null],
  ] as const;

  test.each(cases)("%sでは %s を返すこと", (_, reason, direction, expected) => {
    const key = findBlockingPartitionKey(3, {
      id: 0,
      reason,
      head: 4,
      direction,
    });

    expect(key).toBe(expected);
  });
});

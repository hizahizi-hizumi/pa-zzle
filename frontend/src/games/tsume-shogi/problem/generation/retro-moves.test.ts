import {
  createProblemSeededRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";
import { generateTsumeShogiRetroSteps } from "@/games/tsume-shogi/problem/generation/retro-moves";
import { applyTsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  formatTsumeShogiPosition,
  getTsumeShogiPieceAt,
} from "@/games/tsume-shogi/puzzle/position";

describe("generateTsumeShogiRetroSteps", () => {
  // 1手詰（▲5二金打）の局面。
  const position = createTsumeShogiPosition("4k4/9/4P4/9/9/9/9/9/9", {
    gold: 1,
  });
  const random = createProblemSeededRandom("tsume-shogi-retro-moves");
  function shuffle<T>(values: readonly T[]): T[] {
    return shuffleProblemValues(values, random);
  }

  test("攻方の王手と玉方の応手を指すと元の局面に戻る候補を返すこと", () => {
    const steps = Array.from(
      generateTsumeShogiRetroSteps(position, shuffle),
    ).slice(0, 50);

    const restored = steps.map((step) =>
      formatTsumeShogiPosition(
        applyTsumeShogiMove(
          applyTsumeShogiMove(step.position, step.attackerMove),
          step.defenderMove,
        ),
      ),
    );

    expect(steps.length).toBeGreaterThan(0);
    expect(new Set(restored)).toEqual(
      new Set([formatTsumeShogiPosition(position)]),
    );
  });

  test("攻方の駒打ち・成り・駒取りと玉方の駒取りを含む候補を返すこと", () => {
    const steps = Array.from(generateTsumeShogiRetroSteps(position, shuffle));

    const kinds = new Set(
      steps.flatMap((step) => {
        const afterCheck = applyTsumeShogiMove(
          step.position,
          step.attackerMove,
        );
        return [
          step.attackerMove.kind === "drop" ? "攻方の駒打ち" : null,
          step.attackerMove.kind === "board" && step.attackerMove.promote
            ? "攻方の成り"
            : null,
          getTsumeShogiPieceAt(step.position, step.attackerMove.to) !== null
            ? "攻方の駒取り"
            : null,
          getTsumeShogiPieceAt(afterCheck, step.defenderMove.to) !== null
            ? "玉方の駒取り"
            : null,
        ];
      }),
    );

    expect(kinds).toEqual(
      new Set([
        null,
        "攻方の駒打ち",
        "攻方の成り",
        "攻方の駒取り",
        "玉方の駒取り",
      ]),
    );
  });
});

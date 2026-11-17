import {
  applyTsumeShogiMove,
  canTsumeShogiMovePromote,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  getTsumeShogiPieceAt,
} from "@/games/tsume-shogi/puzzle/position";
import { _private } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/PromotionFigure";

const { promotions } = _private;

const sfenLetters = {
  rook: "R",
  bishop: "B",
  silver: "S",
  knight: "N",
  lance: "L",
  pawn: "P",
} as const;

/** 5筋の四段目か五段目から、上の3段の升へ1手で動ける手。 */
const promotingMoves = {
  rook: { from: 5, to: { file: 5, rank: 3 } },
  bishop: { from: 5, to: { file: 3, rank: 3 } },
  silver: { from: 4, to: { file: 5, rank: 3 } },
  knight: { from: 5, to: { file: 4, rank: 3 } },
  lance: { from: 5, to: { file: 5, rank: 3 } },
  pawn: { from: 4, to: { file: 5, rank: 3 } },
} as const satisfies Record<
  keyof typeof sfenLetters,
  { from: number; to: { file: number; rank: number } }
>;

/**
 * 攻方の駒を5筋に置き、上の3段へ成って動かした後の駒。玉方の玉は動きの線に乗らない2九に置く。
 */
function promoteByProduction(type: keyof typeof sfenLetters) {
  const { from, to } = promotingMoves[type];
  const rows = Array.from({ length: 9 }, () => "9");
  rows[from - 1] = `4${sfenLetters[type]}4`;
  rows[8] = "7k1";
  const position = createTsumeShogiPosition(rows.join("/"), {});
  const move: TsumeShogiMove = {
    kind: "board",
    from: { file: 5, rank: from },
    to,
    promote: true,
  };
  return {
    promotable: canTsumeShogiMovePromote("attacker", type, move),
    promoted: getTsumeShogiPieceAt(applyTsumeShogiMove(position, move), move.to)
      ?.type,
  };
}

describe("promotions", () => {
  test.each(promotions)(
    "図の成った姿が、本番で上の3段へ成って動いた駒と一致すること: %s",
    (type, promotedType) => {
      const result = promoteByProduction(type);

      expect(result).toEqual({ promotable: true, promoted: promotedType });
    },
  );

  test("本番で成れる駒をすべて並べること", () => {
    const types = promotions.map(([type]) => type).sort();

    expect(types).toEqual(Object.keys(sfenLetters).sort());
  });
});

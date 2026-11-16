import { listTsumeShogiLegalMoves } from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  type TsumeShogiPieceType,
} from "@/games/tsume-shogi/puzzle/position";
import {
  _private,
  pieceMovementFigureTypes,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/PieceMovementFigure";

const { pieceMovements } = _private;

/** SFEN の盤面の駒の字。 */
const sfenLetters = {
  rook: "R",
  dragon: "+R",
  bishop: "B",
  horse: "+B",
  gold: "G",
  silver: "S",
  knight: "N",
  lance: "L",
  pawn: "P",
} as const satisfies Partial<Record<TsumeShogiPieceType, string>>;

/**
 * 5五に攻方の駒を1枚だけ置き、玉方の玉を、5五からどの向きの線にも乗らない2九に置いた局面で、本番の合法手が行ける升。
 * 攻方は玉を持てないので、玉の動きはこの照らし方では確かめない。
 */
function listProductionSquares(type: keyof typeof sfenLetters): string[] {
  const rows = Array.from({ length: 9 }, () => "9");
  rows[4] = `4${sfenLetters[type]}4`;
  rows[8] = "7k1";
  const position = createTsumeShogiPosition(rows.join("/"), {});
  const squares = listTsumeShogiLegalMoves(position)
    .filter((move) => move.kind === "board")
    .map(({ to }) => `${to.file}${to.rank}`);
  return [...new Set(squares)].sort();
}

/** 図の点と矢印から、5五の駒が行ける升。右が筋の小さい側、下が段の大きい側。矢印はその向きの盤の端まで。 */
function listFigureSquares(type: keyof typeof sfenLetters): string[] {
  const squares = pieceMovements[type].flatMap(({ dx, dy, ranging }) => {
    const reached: string[] = [];
    for (let step = 1; step <= (ranging ? 8 : 1); step += 1) {
      const file = 5 - dx * step;
      const rank = 5 + dy * step;
      if (file < 1 || file > 9 || rank < 1 || rank > 9) break;
      reached.push(`${file}${rank}`);
    }
    return reached;
  });
  return [...new Set(squares)].sort();
}

describe("pieceMovements", () => {
  const types = pieceMovementFigureTypes.filter(
    (type): type is keyof typeof sfenLetters => type !== "king",
  );

  test.each(types)(
    "図の動きが、本番の合法手で駒が行ける升と一致すること: %s",
    (type) => {
      const production = listProductionSquares(type);

      const figure = listFigureSquares(type);

      expect(figure).toEqual(production);
    },
  );
});

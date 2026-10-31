import type {
  TsumeShogiHandPieceType,
  TsumeShogiPieceType,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";

/** 盤上の駒に書く1文字。 */
export const tsumeShogiPieceCharacters = {
  king: "玉",
  rook: "飛",
  bishop: "角",
  gold: "金",
  silver: "銀",
  knight: "桂",
  lance: "香",
  pawn: "歩",
  dragon: "龍",
  horse: "馬",
  promSilver: "全",
  promKnight: "圭",
  promLance: "杏",
  promPawn: "と",
} as const satisfies Record<TsumeShogiPieceType, string>;

/** 読み上げや説明で使う駒の名前。 */
export const tsumeShogiPieceNames = {
  king: "玉",
  rook: "飛車",
  bishop: "角",
  gold: "金",
  silver: "銀",
  knight: "桂馬",
  lance: "香車",
  pawn: "歩",
  dragon: "龍",
  horse: "馬",
  promSilver: "成銀",
  promKnight: "成桂",
  promLance: "成香",
  promPawn: "と金",
} as const satisfies Record<TsumeShogiPieceType, string>;

export const tsumeShogiHandPieceNames: Record<TsumeShogiHandPieceType, string> =
  tsumeShogiPieceNames;

const rankKanji = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 段の漢数字。 */
export function formatTsumeShogiRank(rank: number): string {
  return rankKanji[rank - 1] ?? String(rank);
}

/** 升の名前（例: 2二）。 */
export function formatTsumeShogiSquare(square: TsumeShogiSquare): string {
  return `${square.file}${formatTsumeShogiRank(square.rank)}`;
}

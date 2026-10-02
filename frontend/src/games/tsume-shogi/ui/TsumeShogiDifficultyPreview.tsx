import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type {
  TsumeShogiBoardPiece,
  TsumeShogiHandPieceType,
  TsumeShogiPieceType,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/**
 * 難易度プレビューは、盤の右上隅（5〜1筋・一〜三段）を切り出し、隅の玉を攻める局面を模した図である。実際の問題ではなく、
 * どの局面も5手以内に詰まない（正解の手順を持たない）。将棋を知る人がひと目で上のレベルほど難しそうだと感じることを、
 * 難易度の特徴量との厳密な対応より優先する。
 *
 * - 攻方の駒（遠くの龍）と持駒（金・桂）はどのレベルでも同じ。攻め手が増えて易しく見えないようにする。
 * - 玉は隅（1一）のまま、玉方の守り駒をレベルが上がるほど足し、穴熊の囲いに近づけて固く見せる。
 *   上のレベルは下のレベルの駒をすべて同じ位置に含む。
 *
 * 盤面は1升1文字で、左が5筋。大文字が攻方、小文字が玉方の駒、`.` は空き。`D` は龍。
 */
const attackerHand = ["gold", "knight"] as const;

const previewLayouts = {
  "1": { board: ["....k", "....l", "D...."], hand: attackerHand },
  "2": { board: ["...nk", "....l", "D...."], hand: attackerHand },
  "3": { board: ["...nk", "...sl", "D...."], hand: attackerHand },
  "4": { board: ["..gnk", "...sl", "D.p.p"], hand: attackerHand },
  "5": { board: ["..gnk", "..gsl", "D.p.p"], hand: attackerHand },
} as const satisfies Record<
  TsumeShogiDifficulty,
  { board: readonly string[]; hand: readonly TsumeShogiHandPieceType[] }
>;

/** 切り出した盤の左端の筋。右端は1筋。 */
const PREVIEW_LEFT_FILE = 5;

const pieceTypesByMark = {
  k: "king",
  r: "rook",
  b: "bishop",
  g: "gold",
  s: "silver",
  n: "knight",
  l: "lance",
  p: "pawn",
  d: "dragon",
} as const satisfies Record<string, TsumeShogiPieceType>;

function toPieceType(mark: string): TsumeShogiPieceType {
  const type =
    pieceTypesByMark[mark.toLowerCase() as keyof typeof pieceTypesByMark];
  if (!type) {
    throw new RangeError(`プレビューの駒の記号が不正です: ${mark}`);
  }
  return type;
}

function readPreviewBoardPieces(
  difficulty: TsumeShogiDifficulty,
): TsumeShogiBoardPiece[] {
  return previewLayouts[difficulty].board.flatMap((row, rowIndex) =>
    Array.from(row).flatMap(function toBoardPiece(mark, columnIndex) {
      if (mark === ".") return [];
      return [
        {
          square: { file: PREVIEW_LEFT_FILE - columnIndex, rank: rowIndex + 1 },
          piece: {
            side: mark === mark.toUpperCase() ? "attacker" : "defender",
            type: toPieceType(mark),
          },
        },
      ];
    }),
  );
}

type TsumeShogiDifficultyPreviewProps = {
  difficulty: TsumeShogiDifficulty;
};

export function TsumeShogiDifficultyPreview({
  difficulty,
}: TsumeShogiDifficultyPreviewProps) {
  const { board, hand } = previewLayouts[difficulty];
  const boardPieces = readPreviewBoardPieces(difficulty);
  const rankCount = board.length;
  const fileCount = board[0]?.length ?? 0;

  return (
    <span
      aria-hidden="true"
      // 5筋分の盤と持駒の列（升6つ分と枠・隙間）がプレビュー枠（128px）に、3段が図の高さに収まる升の大きさにする。
      className="flex h-14 w-full items-center [--preview-unit:17px] lg:h-28 lg:justify-center lg:[--preview-unit:20px]"
    >
      {/* 攻方の持駒は、プレイ画面と同じく盤の外に並べる。盤の下端にそろえる。 */}
      <span className="flex items-end gap-1 lg:gap-1.5">
        {/* 盤の上辺と右辺だけが本当の盤の端。左と下は盤の続きを切り落とした側なので、枠を描かない。 */}
        <span
          className={cn(
            "grid border-t-2 border-r-2",
            tsumeShogiToneClassNames.boardSurface,
            tsumeShogiToneClassNames.boardEdge,
          )}
          style={{
            gridTemplateColumns: `repeat(${fileCount}, var(--preview-unit))`,
            gridAutoRows: "var(--preview-unit)",
          }}
        >
          {board.flatMap((row, rowIndex) =>
            Array.from(row, (_, columnIndex) => {
              const file = PREVIEW_LEFT_FILE - columnIndex;
              const rank = rowIndex + 1;
              const boardPiece = boardPieces.find(
                ({ square }) => square.file === file && square.rank === rank,
              );
              return (
                <span
                  key={`${file}-${rank}`}
                  className={cn(
                    "flex items-center justify-center",
                    tsumeShogiToneClassNames.boardLine,
                    file !== 1 && "border-r",
                    rank !== rankCount && "border-b",
                  )}
                >
                  {boardPiece && (
                    <TsumeShogiPieceGlyph
                      type={boardPiece.piece.type}
                      side={boardPiece.piece.side}
                      size="board"
                    />
                  )}
                </span>
              );
            }),
          )}
        </span>
        <span className="flex flex-col">
          {hand.map((type) => (
            <span
              key={type}
              className="flex size-(--preview-unit) items-center justify-center"
            >
              <TsumeShogiPieceGlyph type={type} side="attacker" size="board" />
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

export const _private = { previewLayouts, readPreviewBoardPieces };

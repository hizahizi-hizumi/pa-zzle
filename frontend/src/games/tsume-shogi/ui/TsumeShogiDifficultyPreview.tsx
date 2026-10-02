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
 * 難易度プレビューは、盤の右上隅（5〜1筋・一〜三段）を切り出し、隅の玉に向けて攻方の駒と持駒を置いた模式図である。実際の問題ではなく、
 * どの局面も5手以内に詰まない（正解の手順を持たない）。
 *
 * - 玉方の駒（玉・金・香）はどのレベルでも同じ。攻方の駒と持駒をレベルが上がるほど足し、初手に指せる王手の候補を増やす。
 *   誤王手の紛れはこの候補の中から生まれるので、候補の広さで読み比べる量を表す。
 * - 上のレベルは下のレベルの駒と持駒をすべて同じ位置に含む。レベル3 から盤上の駒を、レベル4 から成駒（馬）を足し、
 *   手筋（成・遠い利き）を組み合わせて比べる局面に近づける。
 * - 王手の候補の数は、そのレベルの問題を作る生成条件（`tsumeShogiLevelCombinations` の `generationRootChecks`）の範囲に入れる。
 *
 * 盤面は1升1文字で、左が5筋。大文字が攻方、小文字が玉方の駒、`.` は空き。`H` は馬。
 */
const previewLayouts = {
  "1": { board: ["..gkl", ".....", "....."], hand: ["gold"] },
  "2": { board: ["..gkl", ".....", "....."], hand: ["gold", "knight"] },
  "3": { board: ["..gkl", ".....", "...P."], hand: ["gold", "knight"] },
  "4": { board: ["..gkl", ".H...", "...P."], hand: ["gold", "knight"] },
  "5": {
    board: ["..gkl", ".H...", "...P."],
    hand: ["gold", "knight", "silver"],
  },
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
  h: "horse",
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
      // 320px 幅では選択肢のラベルが折り返さないよう、升を小さくして図の幅を抑える。
      className="flex h-14 w-32 shrink-0 items-center [--preview-unit:16px] min-[360px]:w-36 min-[360px]:[--preview-unit:17px] lg:h-28 lg:w-full lg:justify-center lg:[--preview-unit:26px]"
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

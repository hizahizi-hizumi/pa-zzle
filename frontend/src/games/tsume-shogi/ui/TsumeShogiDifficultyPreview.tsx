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
 * 難易度プレビューは、そのレベルに分類される、成り立つ詰将棋の局面を描く。盤上の駒はすべて盤の右上隅（5〜1筋・一〜三段）に
 * あり、図はその隅だけを切り出す。将棋を知る人がひと目で上のレベルほど難しそうだと感じるよう、局面を選ぶ。
 * - 5つの図は同じ骨格（4二の玉、5二の角、4一の金）から駒を足し・置き換えた一つの家族にし、上のレベルほど飛・馬と守りの
 *   金が加わって入り組んで見えるようにする。
 * - 5つの図で攻方の手順を重ねない。同じ詰み方が並ぶと、レベルの違いが詰み筋の違いに見えない。
 * - 問題集に無い局面にして、図の答えを覚えても出題に影響しないようにする。
 *
 * 盤面は1升1駒で、左が5筋。大文字が攻方、小文字が玉方の駒、`+` が付くと成った駒、`.` は空き。
 */
type PreviewProblem = {
  board: readonly string[];
  hand: readonly TsumeShogiHandPieceType[];
};

const previewProblems: Record<TsumeShogiDifficulty, PreviewProblem> = {
  "1": { board: ["..g..", "BkB..", "....."], hand: [] },
  "2": { board: [".gR..", "BkB..", "....."], hand: [] },
  "3": { board: [".g...", "BkB+p.", "....."], hand: [] },
  "4": { board: [".gR..", "Bk.g.", "...+B."], hand: [] },
  "5": { board: [".gR..", "Bk.g.", ".g.+B."], hand: [] },
};

/** 切り出した盤の左端の筋。右端は1筋。 */
const PREVIEW_LEFT_FILE = 5;
const PREVIEW_FILE_COUNT = 5;

const pieceTypesByMark = {
  k: "king",
  r: "rook",
  b: "bishop",
  g: "gold",
  s: "silver",
  n: "knight",
  l: "lance",
  p: "pawn",
  "+r": "dragon",
  "+b": "horse",
  "+s": "promSilver",
  "+n": "promKnight",
  "+l": "promLance",
  "+p": "promPawn",
} as const satisfies Record<string, TsumeShogiPieceType>;

/** 盤面の1段を、升ごとの記号（成った駒は `+` を含む2文字）に分ける。 */
function splitPreviewRow(row: string): string[] {
  return row.match(/\+?[^+]/g) ?? [];
}

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
  return previewProblems[difficulty].board.flatMap((row, rowIndex) =>
    splitPreviewRow(row).flatMap(function toBoardPiece(mark, columnIndex) {
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
  const { board, hand } = previewProblems[difficulty];
  const boardPieces = readPreviewBoardPieces(difficulty);
  const rankCount = board.length;

  return (
    <span
      aria-hidden="true"
      // 5筋分の盤と持駒の列（升6つ分と枠・隙間）がプレビュー枠（128px）に、3段が図の高さに収まる升の大きさにする。
      // 升はプレイ画面と同じく実物の盤の縦長（横 352 : 縦 386）にする。
      className="flex h-14 w-full items-center [--preview-row:calc(var(--preview-unit)*386/352)] [--preview-unit:16px] lg:h-28 lg:justify-center lg:[--preview-unit:20px]"
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
            gridTemplateColumns: `repeat(${PREVIEW_FILE_COUNT}, var(--preview-unit))`,
            gridAutoRows: "var(--preview-row)",
          }}
        >
          {board.flatMap((_, rowIndex) =>
            Array.from({ length: PREVIEW_FILE_COUNT }, (_, columnIndex) => {
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
                      size="miniature"
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
              className="flex h-(--preview-row) w-(--preview-unit) items-center justify-center"
            >
              <TsumeShogiPieceGlyph
                type={type}
                side="attacker"
                size="miniature"
              />
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

export const _private = {
  previewProblems,
  readPreviewBoardPieces,
  splitPreviewRow,
  PREVIEW_FILE_COUNT,
};

import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import {
  type HitofudePuzzleBoard,
  parseHitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";

/** 帯の行の数。どのレベルでも同じにし、レベルの違いを帯の長さと開け具合で見せる。 */
const PREVIEW_ROW_COUNT = 4;

/**
 * レベルごとの帯。盤面の記法（`formatHitofudePuzzleBoard`）で、`.` 通れるマス、`#` 穴、`S` 始点。
 * どの帯も、穴以外の全マスを1回ずつ通る道がちょうど1本ある。
 * - 列の数はレベルが上がるほど増え、帯が長くなる（5〜9 列）。
 * - 内側の穴（四方を通れるマスに囲まれた穴）はどの帯も2個にし、残りの穴は外周の欠けにする。帯のマスに対する穴の割合はどのレベルも
 *   ほぼ同じにする。上のレベルで穴が減ると「障害が減る＝易しくなる」と読まれるので、穴を減らさず、帯が長くなって
 *   開けた所（4マスとも通れる 2×2）が増えることで開け具合の違いを見せる。
 */
const previewStrips = {
  "1": [". # . . .", ". . . # .", "S # . . .", ". . . . ."],
  "2": [". . . . . #", "# . . . . .", ". . # . # .", ". . S . . ."],
  "3": ["S . . . . . .", ". . # . . # .", "# . . . . . .", ". . # . . . ."],
  "4": [
    ". # S . . . . .",
    ". . . . . . . .",
    "# . # . . # . .",
    "# . . . . . . .",
  ],
  "5": [
    ". # . . . . . . #",
    ". . . . . . . . .",
    ". . . # . . # . .",
    ". S . . . . . . #",
  ],
} as const satisfies Record<HitofudePuzzleDifficulty, readonly string[]>;

/** 帯を、列の数を一辺とする正方形の枠の上の行に置き、残りの行をすべて穴にした盤面にする。 */
function createPreviewBoard(
  difficulty: HitofudePuzzleDifficulty,
): HitofudePuzzleBoard {
  const rows: readonly string[] = previewStrips[difficulty];
  const columnCount = rows[0]?.split(" ").length ?? 0;
  const holeRow = Array.from({ length: columnCount }, () => "#").join(" ");
  return parseHitofudePuzzleBoard([
    ...rows,
    ...Array.from({ length: columnCount - rows.length }, () => holeRow),
  ]);
}

type HitofudePuzzleDifficultyPreviewProps = {
  difficulty: HitofudePuzzleDifficulty;
};

/**
 * 難易度プレビューは、4行の横長の帯の盤面を、マス・格子・外形と始点（先端の輪）だけで描く模式図である。実際の問題ではなく、道（答え）は描かない。
 * 上のレベルほど帯が長く、開けた所が広い。実際の問題で上のレベルほど開けた所が広く、先を読んで道を選ぶ所が増える傾向を示す。
 * 4行の帯では実際のレベル3〜5の先読みの重さは再現できないので、帯が示すのは開け具合と込み入り方の傾向だけにする。
 * 盤面は遊ぶときと同じ絵（`HitofudePuzzleFigure`）で描き、穴は描かずに外形で縁取る。
 * マスの大きさはどのレベルでもそろえ、最も長い帯がスマートフォンの見本の枠（幅 128px）に収まる大きさにする。
 */
export function HitofudePuzzleDifficultyPreview({
  difficulty,
}: HitofudePuzzleDifficultyPreviewProps) {
  const board = createPreviewBoard(difficulty);

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-center [--preview-unit:12px] lg:h-28 lg:justify-center lg:[--preview-unit:14px]"
    >
      <span
        className="relative"
        style={{
          width: `calc(var(--preview-unit) * ${board.size})`,
          height: `calc(var(--preview-unit) * ${PREVIEW_ROW_COUNT})`,
        }}
      >
        <HitofudePuzzleFigure
          board={board}
          path={[board.start]}
          isDeadEnd={false}
          solved={false}
          visibleRowCount={PREVIEW_ROW_COUNT}
        />
      </span>
    </span>
  );
}

export const _private = {
  PREVIEW_ROW_COUNT,
  previewStrips,
  createPreviewBoard,
};

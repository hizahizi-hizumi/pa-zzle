import type { HitofudePuzzlePathNotice } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import {
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";
import type { HitofudePuzzleExtensionRejection } from "@/games/hitofude-puzzle/puzzle/transitions";

type HitofudePuzzleStatusAnnouncementProps = {
  board: HitofudePuzzleBoard;
  notice: HitofudePuzzlePathNotice | null;
  isDeadEnd: boolean;
  strandedCellCount: number;
};

function describeCellPosition(size: number, cell: number): string {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  return `${row + 1}行${column + 1}列`;
}

const blockedReasonTexts = {
  "outside-board": "盤面の外へは進めない",
  "not-adjacent": "先端の隣のマスにだけ延ばせる",
  hole: "穴へは進めない",
  visited: "通ったマスへは進めない",
} as const satisfies Record<HitofudePuzzleExtensionRejection, string>;

/** 盤面の変化を読み上げる文。知らせる変化が無ければ空文字。 */
function describeNotice(
  { size }: HitofudePuzzleBoard,
  notice: HitofudePuzzlePathNotice | null,
  isDeadEnd: boolean,
  strandedCellCount: number,
): string {
  if (notice === null) {
    return "";
  }
  if (notice.change === "blocked") {
    const reason = blockedReasonTexts[notice.reason];
    return notice.cell === null || notice.reason === "outside-board"
      ? reason
      : `${describeCellPosition(size, notice.cell)}、${reason}`;
  }
  const sentences = [
    notice.change === "shortened"
      ? `${describeCellPosition(size, notice.head)}まで縮めた`
      : null,
    isDeadEnd ? "行き止まり。先端から進めるマスが無い" : null,
    !isDeadEnd && notice.newlyStranded
      ? `取り残し${strandedCellCount}マス。今の道のままでは通れない`
      : null,
  ].filter((sentence) => sentence !== null);
  return sentences.join("。");
}

/**
 * 盤面の操作で起きた変化（阻まれた・縮めた・行き止まり・取り残し）を、画面には出さずに読み上げで知らせる。
 * 盤面の印や動きで知らせていることを、見えない人にも同じ時に伝える。
 */
export function HitofudePuzzleStatusAnnouncement({
  board,
  notice,
  isDeadEnd,
  strandedCellCount,
}: HitofudePuzzleStatusAnnouncementProps) {
  return (
    <p role="status" className="sr-only">
      {/* 同じ文が続いても読み上げ直されるよう、操作ごとに文の要素を作り直す。 */}
      <span key={notice?.id}>
        {describeNotice(board, notice, isDeadEnd, strandedCellCount)}
      </span>
    </p>
  );
}

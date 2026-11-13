import { useState } from "react";

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
  solved: boolean;
  /**
   * 盤面のマスにフォーカスがあるか。あれば先端が動くとフォーカスが先端のマスへ移り、マスの読み上げ名が先端の位置を伝えるので、
   * 読み上げ欄は何が起きたかだけを伝える。
   */
  boardFocused: boolean;
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

function describeUndoneLength(lengthChange: number): string {
  if (lengthChange < 0) {
    return `待ったで道を${-lengthChange}マス縮めた`;
  }
  if (lengthChange > 0) {
    return `待ったで道を${lengthChange}マス延ばした`;
  }
  return "待ったで道を戻した";
}

function describePathChange(
  notice: Exclude<HitofudePuzzlePathNotice, { change: "blocked" }>,
  headPosition: string | null,
  solved: boolean,
): string {
  if (solved) {
    return "完成。すべてのマスを通った";
  }
  switch (notice.change) {
    case "extended":
      return headPosition === null ? "延ばした" : `${headPosition}へ延ばした`;
    case "shortened":
      return headPosition === null ? "縮めた" : `${headPosition}まで縮めた`;
    case "undone": {
      const undone = describeUndoneLength(notice.lengthChange);
      return headPosition === null
        ? undone
        : `${undone}。先端は${headPosition}`;
    }
  }
}

function describeNotice(
  { size }: HitofudePuzzleBoard,
  notice: HitofudePuzzlePathNotice | null,
  { isDeadEnd, solved, boardFocused }: HitofudePuzzleStatusAnnouncementProps,
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
  const headPosition = boardFocused
    ? null
    : describeCellPosition(size, notice.head);
  return [
    describePathChange(notice, headPosition, solved),
    isDeadEnd ? "行き止まり。先端から進めるマスが無い" : null,
  ]
    .filter((sentence) => sentence !== null)
    .join("。");
}

/**
 * 盤面の印や動きで知らせていることを、見えない人にも同じ時に伝える。
 * マスの読み上げ名はマスの位置と状態を、この欄は操作で何が起きたかを伝える。
 */
export function HitofudePuzzleStatusAnnouncement(
  props: HitofudePuzzleStatusAnnouncementProps,
) {
  const { board, notice } = props;
  const noticeId = notice?.id ?? null;
  const text = describeNotice(board, notice, props);
  // 文は操作の時点の状態で決め、後でフォーカスが移っても書き換えない。書き換えると同じ操作を読み上げ直す。
  const [announcement, setAnnouncement] = useState({ noticeId, text });
  if (announcement.noticeId !== noticeId) {
    setAnnouncement({ noticeId, text });
  }
  const announcedText =
    announcement.noticeId === noticeId ? announcement.text : text;

  return (
    <p role="status" className="sr-only">
      {/* 同じ文が続いても読み上げ直されるよう、操作ごとに文の要素を作り直す。 */}
      <span key={noticeId}>{announcedText}</span>
    </p>
  );
}

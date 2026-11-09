import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type BridgesStatusAnnouncementProps = {
  board: BridgesBoard;
  notice: BridgesEdgeNotice | null;
  solved: boolean;
};

function describeEdge(board: BridgesBoard, edge: number): string {
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  const [a, b] = [board.islands[from]!, board.islands[to]!];
  return `${a.row + 1}行${a.column + 1}列と${b.row + 1}行${b.column + 1}列の間`;
}

function describeNotice(
  board: BridgesBoard,
  notice: BridgesEdgeNotice,
): string {
  switch (notice.change) {
    case "changed":
      return notice.count === 0
        ? `${describeEdge(board, notice.edge)} 橋なし`
        : `${describeEdge(board, notice.edge)} 橋${notice.count}本`;
    case "blocked":
      return `${describeEdge(board, notice.edge)} 交わる橋があって架けられない`;
    case "undone":
      return PLAY_OPERATION_LABELS.undo;
  }
}

/**
 * 盤面操作の結果を支援技術へ知らせる、見えない読み上げ。盤面には文字を出さず、形と色で知らせる。
 */
export function BridgesStatusAnnouncement({
  board,
  notice,
  solved,
}: BridgesStatusAnnouncementProps) {
  const message = solved
    ? "完成"
    : notice === null
      ? ""
      : describeNotice(board, notice);

  return (
    <p role="status" className="sr-only">
      {/* 同じ文が続いても読み上げ直されるよう、操作ごとに文の要素を作り直す。 */}
      <span key={solved ? "solved" : (notice?.id ?? "none")}>{message}</span>
    </p>
  );
}

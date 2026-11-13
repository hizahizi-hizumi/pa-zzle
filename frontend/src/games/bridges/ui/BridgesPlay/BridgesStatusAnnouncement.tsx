import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { getSeparationNoticeLines } from "@/games/bridges/ui/BridgesPlay/separation-notice";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type BridgesStatusAnnouncementProps = {
  board: BridgesBoard;
  notice: BridgesEdgeNotice | null;
  solved: boolean;
  /** 全島がちょうどなのにつながっていないことを盤面に見せている間の、島の組の数。通常のプレイだけが渡す。 */
  separatedGroupCount?: number | null;
};

function describeEdge(board: BridgesBoard, edge: number): string {
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  const [a, b] = [board.islands[from]!, board.islands[to]!];
  return `${a.row + 1}行${a.column + 1}列と${b.row + 1}行${b.column + 1}列の間`;
}

function describeSeparation(groupCount: number): string {
  const { situation, rule } = getSeparationNoticeLines(groupCount);
  return `${situation} ${rule}`;
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

export function BridgesStatusAnnouncement({
  board,
  notice,
  solved,
  separatedGroupCount = null,
}: BridgesStatusAnnouncementProps) {
  if (solved) {
    return (
      <p role="status" className="sr-only">
        <span key="solved">完成</span>
      </p>
    );
  }

  return (
    <p role="status" className="sr-only">
      {/* 同じ文が続いても読み上げ直されるよう、操作ごとに文の要素を作り直す。 */}
      {notice !== null && (
        <span key={notice.id}>{describeNotice(board, notice)}</span>
      )}
      {/* 分かれている文は出し始めに1度だけ読み、知らせを出したまま阻まれた操作では操作の文だけを読む。 */}
      {separatedGroupCount !== null && (
        <span key="separated">{describeSeparation(separatedGroupCount)}</span>
      )}
    </p>
  );
}

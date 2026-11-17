import type { CSSProperties } from "react";

import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import {
  type BridgesBoard as BridgesBoardState,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import type {
  BridgesExampleCandidate,
  BridgesExampleCycle,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/example-board";
import type { BridgesHowToPlayHint } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import {
  bridgesFigureCellClassName,
  getBridgesFigureBoxStyle,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-size";
import { getBridgesHintPlacement } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/hint-placement";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";
import {
  type BoardRect,
  type BoardView,
  createBoardView,
  getIslandCenter,
  toViewPoint,
} from "@/games/bridges/ui/board/board-geometry";
import { cn } from "@/lib/utils";

type ExampleBoardProps = {
  board: BridgesBoardState;
  bridges: readonly BridgeCount[];
  islandStatuses: readonly BridgesIslandStatus[];
  edgeNotice: BridgesEdgeNotice | null;
  clearing: boolean;
  solved: boolean;
  /** 押す所の手がかりを付ける手。破線の枠と指のアイコンを、動かさずに描く。 */
  hint: BridgesHowToPlayHint | null;
  /** 手ごとに架けられるかの印を付ける線。 */
  candidates: readonly BridgesExampleCandidate[];
  /** 島を選んでから相手の島を押す操作で、選んでいる島。例の状態として持ち、Esc で解けるようにする。 */
  selectedIsland: number | null;
  onCycleEdge: (cycle: BridgesExampleCycle) => void;
  onSelectIsland: (island: number | null) => void;
  onShowCandidates: () => void;
  /** 橋も島の選びも変えなかった押し（線から遠い所など）。 */
  onMissPress: () => void;
  onClearAnimationComplete: () => void;
};

/**
 * 手ごとの印の大きさ。マス幅の 0.42 倍にし、2本の橋の板の幅を覆える大きさにする。マスの小さい幅 320px の画面でも記号が読めるよう、
 * 18px より小さくしない。印は島の中心から1マス先に置くので、18px でも島の陸（中心から 0.46 マス）と重ならない。
 */
const CANDIDATE_MARK_SIZE =
  "max(18px, calc(var(--bridges-figure-cell) * 0.42))";

function toPlacementStyle(view: BoardView, rect: BoardRect): CSSProperties {
  return {
    left: `${(rect.x / view.width) * 100}%`,
    top: `${(rect.y / view.height) * 100}%`,
    width: `${(rect.width / view.width) * 100}%`,
    height: `${(rect.height / view.height) * 100}%`,
  };
}

/** 押す所の手がかり。押す所の箱を置き、共通の手がかりを重ねる。枠と指の大きさは、図のマスを単位にして決める。 */
function renderHint(view: BoardView, hint: BridgesHowToPlayHint) {
  const { rect, outline, pointer, corner, gesture } = getBridgesHintPlacement(
    view,
    hint,
  );
  return (
    <span
      aria-hidden="true"
      data-hint={hint.kind}
      className="pointer-events-none absolute"
      style={
        {
          ...toPlacementStyle(view, rect),
          "--how-to-play-unit": "var(--bridges-figure-cell)",
        } as CSSProperties
      }
    >
      <HowToPlayPressHint
        frame="edge"
        outline={outline}
        pointer={pointer}
        corner={corner}
        gesture={gesture}
      />
    </span>
  );
}

/**
 * 触れる例の盤面。本番の盤面部品をそのまま使い、押す・なぞる・島を選ぶ・右クリック・キーボード、阻まれた反応、島の知らせ、
 * 完成の光を本番と同じにする。海は盤面部品が描く。
 * マスは、ゴールの盤面のマスと同じ物に見える大きさ（`bridgesFigureCellClassName`）で描く。
 * 手ごとの印は、印を付ける島から線の向きへ1マス先に置き、どの島からどの向きへの手かが読めるようにする。
 * 印は共通の判定の記号の札にし、下の海とロープを隠して記号だけを読ませる。本番の阻まれた反応がその線に出ている間は、印を消す。
 * 完成したら、本番と同じく受け付けない。
 * 遊び方は送る画面なので、指でスクロールを止めるのは、なぞりが始まる島の上だけにする。
 */
export function ExampleBoard({
  board,
  bridges,
  islandStatuses,
  edgeNotice,
  clearing,
  solved,
  hint,
  candidates,
  selectedIsland,
  onCycleEdge,
  onSelectIsland,
  onShowCandidates,
  onMissPress,
  onClearAnimationComplete,
}: ExampleBoardProps) {
  const view = createBoardView(board);
  const { edges } = getBridgesNetwork(board);

  function getCandidateStyle({ edge, island }: BridgesExampleCandidate) {
    const other =
      edges[edge]!.from === island ? edges[edge]!.to : edges[edge]!.from;
    const start = getIslandCenter(board.islands[island]!);
    const end = getIslandCenter(board.islands[other]!);
    const center = toViewPoint(view, {
      x: start.x + Math.sign(end.x - start.x),
      y: start.y + Math.sign(end.y - start.y),
    });
    return {
      left: `${(center.x / view.width) * 100}%`,
      top: `${(center.y / view.height) * 100}%`,
      width: CANDIDATE_MARK_SIZE,
      height: CANDIDATE_MARK_SIZE,
    };
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md",
        bridgesFigureCellClassName,
      )}
      style={getBridgesFigureBoxStyle(board)}
    >
      <BridgesBoard
        board={board}
        bridges={bridges}
        islandStatuses={islandStatuses}
        edgeNotice={edgeNotice}
        clearing={clearing}
        solved={solved}
        interactionDisabled={solved}
        showsSea
        touchScrollLock="islands"
        selectedIsland={selectedIsland}
        onCycleEdge={(edge, gesture) =>
          onCycleEdge({ edge, gesture, direction: "forward" })
        }
        onCycleEdgeBackward={(edge) =>
          onCycleEdge({ edge, gesture: "edge", direction: "backward" })
        }
        onIneffectivePress={(kind) => {
          if (kind === "candidates") {
            onShowCandidates();
          } else {
            onMissPress();
          }
        }}
        onSelectIsland={onSelectIsland}
        onClearAnimationComplete={onClearAnimationComplete}
      />
      {candidates.map((candidate) => (
        <span
          key={candidate.edge}
          aria-hidden="true"
          data-candidate-edge={candidate.edge}
          data-candidate-verdict={candidate.allowed ? "allowed" : "disallowed"}
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2"
          style={getCandidateStyle(candidate)}
        >
          <HowToPlayVerdictMark
            verdict={candidate.allowed ? "allowed" : "disallowed"}
            placement="board-tag"
          />
        </span>
      ))}
      {hint === null ? null : renderHint(view, hint)}
    </div>
  );
}

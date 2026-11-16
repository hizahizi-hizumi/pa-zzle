import type { CSSProperties, ReactNode } from "react";

import { HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX } from "@/components/HowToPlayGoalFrame";
import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type {
  SlidePuzzleBoard as SlidePuzzleBoardState,
  SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import { SlidePuzzleGround } from "@/games/slide-puzzle/ui/SlidePuzzleGround";

/**
 * - `example`: ルールと操作の例。横に並べる対が、元に戻すボタンの分を空けた面に収まる大きさにする。
 * - `goal`: 入口のゴールの盤面。置き場所の幅（広い画面では幅と高さの小さい方）いっぱいに描く。
 */
type HowToPlayBoardSize = "example" | "goal";

type HowToPlayBoardProps = {
  board: SlidePuzzleBoardState;
  size: HowToPlayBoardSize;
  operation: SlidePuzzleOperation | null;
  clearing: boolean;
  /** 押す所の手がかりを付けるタイル。タイルの面の中に置き、面と一緒に動かす。指は中央の番号を隠さない右下の角に置く。 */
  hintTile?: SlidePuzzleTile | null;
  /** タイルごとの、押すとスライドするかの札。タイルの番号を隠さないよう右上の角の、手がかりの破線の枠（タイルの 0.1 内側）より内側に置く。 */
  tileVerdicts?: ReadonlyMap<SlidePuzzleTile, boolean>;
  /** 渡すと、タイルを本番の盤面と同じく押せる。 */
  onSlideTile?: (cellIndex: number) => void;
  onClearAnimationComplete?: () => void;
};

/** 盤面の下に敷く地の、盤面の左右の余白を合わせた幅（`SlidePuzzleGround` の `board-frame` の余白 0.5rem の2つ分）。 */
const groundFrameInlinePadding = "1rem";

/** 盤面の幅。地の余白を合わせた幅が、次の幅に収まる大きさにする。 */
const sizeStyles = {
  // 面の幅に1枚が収まり、広い画面では2枚と対の間（40px）が右の列の面（内側 608px）に横に並ぶ大きさまでにする。
  example: {
    width: `calc(min(100cqw, 15rem) - ${groundFrameInlinePadding})`,
  },
  // 置き場所の幅と、置き場所の高さから盤面の下の段（見せ直すボタンと、遊び方の層が置くボタン）を除いた高さの、小さい方に合わせる。
  goal: {
    width: `calc(min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px)) - ${groundFrameInlinePadding})`,
  },
} as const satisfies Record<HowToPlayBoardSize, CSSProperties>;

function ignore() {}

function renderVerdict(slides: boolean): ReactNode {
  return (
    <span className="pointer-events-none absolute top-[4.5cqw] right-[4.5cqw] size-[7cqw]">
      <HowToPlayVerdictMark
        verdict={slides ? "allowed" : "disallowed"}
        placement="board-tag"
      />
    </span>
  );
}

function listTileAdornments(
  board: SlidePuzzleBoardState,
  hintTile: SlidePuzzleTile | null,
  tileVerdicts: ReadonlyMap<SlidePuzzleTile, boolean> | undefined,
): ReadonlyMap<SlidePuzzleTile, ReactNode> {
  return new Map(
    board.flatMap((tile) => {
      const verdict = tileVerdicts?.get(tile);
      const hinted = tile === hintTile;
      if (verdict === undefined && !hinted) {
        return [];
      }
      return [
        [
          tile,
          <>
            {hinted ? (
              <HowToPlayPressHint
                frame="inside"
                outline="square"
                pointer="inside-corner"
              />
            ) : null}
            {verdict === undefined ? null : renderVerdict(verdict)}
          </>,
        ] as const,
      ];
    }),
  );
}

/**
 * 本番の盤面部品で描く、遊び方の盤面。本番と同じくタイルがスライドし、動かないタイルは揺れ、完成するとタイルの波で返す。
 * 盤面のトレイは例の面と同じ色なので、プレイ画面と同じ地を下に敷いて盤面の縁と空白を見せる。
 */
export function HowToPlayBoard({
  board,
  size,
  operation,
  clearing,
  hintTile = null,
  tileVerdicts,
  onSlideTile,
  onClearAnimationComplete = ignore,
}: HowToPlayBoardProps) {
  return (
    <SlidePuzzleGround shape="board-frame">
      <div className="aspect-square" style={sizeStyles[size]}>
        <SlidePuzzleBoard
          board={board}
          operation={operation}
          interactionDisabled={onSlideTile === undefined || clearing}
          clearing={clearing}
          tileAdornments={listTileAdornments(board, hintTile, tileVerdicts)}
          onSlideTile={onSlideTile ?? ignore}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </div>
    </SlidePuzzleGround>
  );
}

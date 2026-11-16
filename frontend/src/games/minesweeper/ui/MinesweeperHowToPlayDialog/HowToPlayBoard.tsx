import type { CSSProperties } from "react";

import { HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX } from "@/components/HowToPlayGoalFrame";
import type { HowToPlayPressHintGesture } from "@/components/HowToPlayPressHint";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "@/games/minesweeper/ui/board/MinesweeperBoard";
import {
  MINESWEEPER_BOARD_GAP_PX,
  MINESWEEPER_BOARD_PADDING_INLINE_PX,
} from "@/games/minesweeper/ui/board/MinesweeperBoardGrid";
import {
  listMinesweeperExampleVisibleCells,
  type MinesweeperExampleBoard,
  type MinesweeperExampleCandidate,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import { CellMarks } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/HowToPlayBoard/CellMarks";

/**
 * - `goal`: 入口のゴールの盤面。置き場所の幅（広い画面では幅と高さの小さい方）いっぱいに描く。
 * - `example`: 触れる例。狭い画面では 40px、広い画面では 48px のマスにし、ゴールの盤面のマスと同じ物に見える大きさにそろえる。
 * - `inherited`: 置き場所がマスの大きさ（`--minesweeper-figure-cell`）を決めて渡す図。
 */
type MinesweeperHowToPlayBoardSize = "goal" | "example" | "inherited";

/** 押す所の手がかりを付けるマスと、その押し方。 */
type MinesweeperHowToPlayHint = {
  cellIndex: number;
  press: HowToPlayPressHintGesture;
};

type HowToPlayBoardProps = {
  example: MinesweeperExampleBoard;
  size: MinesweeperHowToPlayBoardSize;
  mode?: MinesweeperInputMode;
  /** 閉じたマスごとの札（✓ / ✕）。 */
  candidates?: ReadonlyMap<number, MinesweeperExampleCandidate>;
  hint?: MinesweeperHowToPlayHint | null;
  /** 押せない図で、そのコマの前の操作で押したマス。 */
  pressedCellIndex?: number;
  /** 押せない図を、読み上げで1枚の絵として伝えるときの名前。 */
  label?: string;
  /** 押せる例で、本番のプレイ中でない盤面と同じく、マスを押せなくするか（完成した後など）。 */
  interactionDisabled?: boolean;
  /** 渡すと、マスを本番の盤面と同じく押せる（押す・長押し・右クリック）。 */
  onRevealCell?: (cellIndex: number) => void;
  onToggleFlag?: (cellIndex: number) => void;
  onChordCell?: (cellIndex: number) => void;
};

function getBoardWidth(columns: number): string {
  return `calc(${columns} * var(--minesweeper-figure-cell) + ${(columns - 1) * MINESWEEPER_BOARD_GAP_PX + MINESWEEPER_BOARD_PADDING_INLINE_PX}px)`;
}

/** 広い画面では、見せ直すボタンの段と遊び方の層が盤面の下に置くボタンの段を、置き場所の高さから除く。 */
const goalBoardWidth = `min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px))`;

const sizeClassNames = {
  goal: "",
  example:
    "[--minesweeper-figure-cell:40px] lg:[--minesweeper-figure-cell:48px]",
  inherited: "",
} as const satisfies Record<MinesweeperHowToPlayBoardSize, string>;

function ignorePress() {}

/**
 * 遊び方の盤面。本番の盤面部品（マス・旗・地雷・数字・押し方）をそのまま使い、遊び方だけの見せ方（札・手がかり・押したマスの枠）を重ねる。
 * ゴールの盤面と押せない図は、本番の操作を受け付けない盤面と同じに描き、読み上げでは1枚の絵として伝える。
 */
export function HowToPlayBoard({
  example,
  size,
  mode = "reveal",
  candidates,
  hint,
  pressedCellIndex,
  label,
  interactionDisabled = false,
  onRevealCell,
  onToggleFlag,
  onChordCell,
}: HowToPlayBoardProps) {
  const { rows, columns } = example.board;
  const cells = listMinesweeperExampleVisibleCells(example);
  const interactive =
    onRevealCell !== undefined ||
    onToggleFlag !== undefined ||
    onChordCell !== undefined;
  const style: CSSProperties = {
    width: size === "goal" ? goalBoardWidth : getBoardWidth(columns),
  };

  const board = (
    <MinesweeperBoard
      rows={rows}
      columns={columns}
      cells={cells}
      mode={mode}
      interactionDisabled={!interactive || interactionDisabled}
      onRevealCell={onRevealCell ?? ignorePress}
      onToggleFlag={onToggleFlag ?? ignorePress}
      onChordCell={onChordCell ?? ignorePress}
      renderCellOverlay={(cellIndex) => {
        const candidate = candidates?.get(cellIndex);
        const hinted = hint?.cellIndex === cellIndex;
        const pressed = pressedCellIndex === cellIndex;
        if (candidate === undefined && !hinted && !pressed) {
          return null;
        }
        return (
          <CellMarks
            candidate={candidate}
            hint={hinted ? hint?.press : undefined}
            pressed={pressed}
            occupied={cells[cellIndex]?.state !== "hidden"}
          />
        );
      }}
    />
  );

  if (interactive) {
    return (
      <div className={`shrink-0 ${sizeClassNames[size]}`} style={style}>
        {board}
      </div>
    );
  }
  return (
    <div
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={`shrink-0 ${sizeClassNames[size]}`}
      style={style}
    >
      {/* 本番の盤面部品は押せないマスもボタンで描くので、絵の中身として読み上げない。 */}
      <div aria-hidden="true">{board}</div>
    </div>
  );
}

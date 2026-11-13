import type { ReactNode } from "react";

import {
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeBoardSize,
  type HakoiriMusumeGoal,
  type HakoiriMusumeLayout,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  BOX_RIM_CELLS,
  type BoxRect,
  getBoxExtent,
  getBoxRect,
  toBoxStyle,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import { hakoiriMusumeToneClassNames } from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";

/** 目標の駒が抜け切ったときに出口の縁に差す光の届く所。切り欠きから、箱の底へ少し入った所まで。 */
const EXIT_LIGHT_REACH_CELLS = 0.6;

/** 目標が2つのときに出口へ入れる筋の太さ（マス幅に対する割合）。切り欠きの外の端に沿わせる。 */
const EXIT_MARK_CELLS = 0.07;

/** 出口の、辺に沿った始めのマスの位置と、出口の幅（マスの数）。 */
function getExitSpan(size: HakoiriMusumeBoardSize, goal: HakoiriMusumeGoal) {
  const positions = goal.exitCells.map((cell) =>
    getHakoiriMusumeCellPosition(size, cell),
  );
  return {
    row: Math.min(...positions.map((position) => position.row)),
    column: Math.min(...positions.map((position) => position.column)),
    length: positions.length,
  };
}

/**
 * 出口の幅で、出口の辺から箱の内側へ `inward` マス・外側へ `outward` マスまでの帯。負の `inward` は辺より外から始める。
 */
function getExitBand(
  size: HakoiriMusumeBoardSize,
  goal: HakoiriMusumeGoal,
  inward: number,
  outward: number,
): BoxRect {
  const { row, column, length } = getExitSpan(size, goal);
  const depth = inward + outward;
  switch (goal.exitSide) {
    case "bottom":
      return getBoxRect(
        size,
        { row: size.rows - inward, column },
        { columns: length, rows: depth },
      );
    case "top":
      return getBoxRect(
        size,
        { row: -outward, column },
        { columns: length, rows: depth },
      );
    case "right":
      return getBoxRect(
        size,
        { row, column: size.columns - inward },
        { columns: depth, rows: length },
      );
    case "left":
      return getBoxRect(
        size,
        { row, column: -outward },
        { columns: depth, rows: length },
      );
  }
}

type HakoiriMusumeBoxProps = {
  layout: HakoiriMusumeLayout;
  /** 箱の中に置く駒。箱の外形に対する位置（`board-geometry` の割合）で置き、箱の外形からはみ出した所は見せない。 */
  children: ReactNode;
};

/**
 * 桐の箱。縁と底と壁と、縁を切り欠いた出口を描き、その上に駒を置く。出口は箱の外の明るさが差し込む色にし、切り欠いた縁の木口を
 * 明るく見せて、縁の切れ目と分かるようにする。目標が2つなら、出口ごとにその目標の駒の漆の色の筋を入れる。出口の前のマスは塗らない。
 * 外形の縦横比は箱の形のまま保ち、駒の字の大きさは箱の幅（`cqw`）から決める。
 */
export function HakoiriMusumeBox({ layout, children }: HakoiriMusumeBoxProps) {
  const extent = getBoxExtent(layout);
  const floorRect = getBoxRect(layout, { row: 0, column: 0 }, layout);
  const marked = layout.goals.length > 1;
  return (
    <div
      data-box=""
      className="relative size-full [container-type:inline-size]"
      style={{ aspectRatio: `${extent.width} / ${extent.height}` }}
    >
      <div
        className={`absolute inset-0 rounded-[2cqw] ${hakoiriMusumeToneClassNames.boxRim} ${hakoiriMusumeToneClassNames.boxShadow}`}
      />
      <div
        className={`absolute rounded-[1cqw] ${hakoiriMusumeToneClassNames.boxFloor}`}
        style={toBoxStyle(floorRect)}
      />
      {layout.walls.map((wall) => (
        <div
          key={`wall-${wall}`}
          data-box-wall=""
          className={`absolute ${hakoiriMusumeToneClassNames.wall}`}
          style={toBoxStyle(
            getBoxRect(layout, getHakoiriMusumeCellPosition(layout, wall), {
              columns: 1,
              rows: 1,
            }),
          )}
        />
      ))}
      {layout.goals.map((goal, target) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: 行き先の番号は目標の駒の番号で、問題の間は変わらない
          key={`exit-${target}`}
          data-box-exit={goal.exitSide}
          className={`absolute ${hakoiriMusumeToneClassNames.exitOpening[goal.exitSide]}`}
          style={toBoxStyle(getExitBand(layout, goal, 0, BOX_RIM_CELLS))}
        />
      ))}
      {marked &&
        layout.goals.map((goal, target) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 行き先の番号は目標の駒の番号で、問題の間は変わらない
            key={`exit-mark-${target}`}
            aria-hidden="true"
            className={`absolute opacity-80 ${hakoiriMusumeToneClassNames.exitMarks[target]}`}
            style={toBoxStyle(
              getExitBand(
                layout,
                goal,
                EXIT_MARK_CELLS - BOX_RIM_CELLS,
                BOX_RIM_CELLS,
              ),
            )}
          />
        ))}
      {layout.goals.map((goal, target) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: 行き先の番号は目標の駒の番号で、問題の間は変わらない
          key={`exit-light-${target}`}
          data-box-exit-light={target}
          aria-hidden="true"
          className={`pointer-events-none absolute opacity-0 ${hakoiriMusumeToneClassNames.exitLight[goal.exitSide]}`}
          style={toBoxStyle(
            getExitBand(layout, goal, EXIT_LIGHT_REACH_CELLS, BOX_RIM_CELLS),
          )}
        />
      ))}
      {/* 出口を抜けた目標の駒が箱の外へはみ出さないよう、駒は箱の外形で切り取る。 */}
      <div className="absolute inset-0 overflow-hidden rounded-[2cqw]">
        {children}
      </div>
    </div>
  );
}

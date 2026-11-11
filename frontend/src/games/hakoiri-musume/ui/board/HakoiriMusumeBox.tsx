import type { ReactNode } from "react";

import {
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
  hakoiriMusumeExitColumns,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  BOX_HEIGHT_CELLS,
  BOX_RIM_CELLS,
  BOX_WIDTH_CELLS,
  getBoxRect,
  toBoxStyle,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import { hakoiriMusumeToneClassNames } from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";

const floorRect = getBoxRect(
  { row: 0, column: 0 },
  { columns: HAKOIRI_MUSUME_COLUMNS, rows: HAKOIRI_MUSUME_ROWS },
);

/** 出口の切り欠き。下の縁を、出口の列の幅で外形の下端まで抜く。 */
const exitRect = getBoxRect(
  { row: HAKOIRI_MUSUME_ROWS, column: hakoiriMusumeExitColumns[0] },
  { columns: hakoiriMusumeExitColumns.length, rows: BOX_RIM_CELLS },
);

/** 娘が抜け切ったときに出口の縁に差す光の届く所。切り欠きから、箱の底へ少し入った所まで。 */
const EXIT_LIGHT_REACH_CELLS = 0.6;
const exitLightRect = getBoxRect(
  {
    row: HAKOIRI_MUSUME_ROWS - EXIT_LIGHT_REACH_CELLS,
    column: hakoiriMusumeExitColumns[0],
  },
  {
    columns: hakoiriMusumeExitColumns.length,
    rows: EXIT_LIGHT_REACH_CELLS + BOX_RIM_CELLS,
  },
);

type HakoiriMusumeBoxProps = {
  /** 箱の中に置く駒。箱の外形に対する位置（`board-geometry` の割合）で置き、箱の外形からはみ出した所は見せない。 */
  children: ReactNode;
};

/**
 * 桐の箱。縁と底と、下の縁の真ん中2マスを切り欠いた出口を描き、その上に駒を置く。出口は箱の外の明るさが差し込む色にし、
 * 切り欠いた縁の木口を明るく見せて、縁の切れ目と分かるようにする。出口の前のマスは塗らない。
 * 外形の縦横比は箱の形のまま保ち、駒の字の大きさは箱の幅（`cqw`）から決める。
 */
export function HakoiriMusumeBox({ children }: HakoiriMusumeBoxProps) {
  return (
    <div
      data-box=""
      className="relative size-full [container-type:inline-size]"
      style={{ aspectRatio: `${BOX_WIDTH_CELLS} / ${BOX_HEIGHT_CELLS}` }}
    >
      <div
        className={`absolute inset-0 rounded-[2cqw] ${hakoiriMusumeToneClassNames.boxRim} ${hakoiriMusumeToneClassNames.boxShadow}`}
      />
      <div
        className={`absolute rounded-[1cqw] ${hakoiriMusumeToneClassNames.boxFloor}`}
        style={toBoxStyle(floorRect)}
      />
      <div
        className={`absolute ${hakoiriMusumeToneClassNames.exitOpening}`}
        style={toBoxStyle(exitRect)}
      />
      <div
        data-box-exit-light=""
        aria-hidden="true"
        className={`pointer-events-none absolute origin-bottom opacity-0 ${hakoiriMusumeToneClassNames.exitLight}`}
        style={toBoxStyle(exitLightRect)}
      />
      {/* 出口を抜けた娘が箱の外へはみ出さないよう、駒は箱の外形で切り取る。 */}
      <div className="absolute inset-0 overflow-hidden rounded-[2cqw]">
        {children}
      </div>
    </div>
  );
}

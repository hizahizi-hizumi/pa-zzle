import type { ReactNode } from "react";

import {
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
  type HakoiriMusumePieceKind,
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
  { row: 5, column: hakoiriMusumeExitColumns[0] },
  { columns: hakoiriMusumeExitColumns.length, rows: BOX_RIM_CELLS },
);

type HakoiriMusumeBoxProps = {
  /** 箱の中に置く駒。箱の外形に対する位置（`board-geometry` の割合）で置く。 */
  children: ReactNode;
};

/**
 * 桐の箱。縁と底と、下の縁の真ん中2マスを切り欠いた出口を描き、その上に駒を置く。
 * 外形の縦横比は箱の形のまま保ち、駒の字の大きさは箱の幅（`cqw`）から決める。
 */
export function HakoiriMusumeBox({ children }: HakoiriMusumeBoxProps) {
  return (
    <div
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
      {children}
    </div>
  );
}

type HakoiriMusumePieceFaceProps = {
  kind: HakoiriMusumePieceKind;
};

/** 駒の面。置かれた所いっぱいに描く。娘だけは朱漆で「娘」の字を入れる。 */
export function HakoiriMusumePieceFace({ kind }: HakoiriMusumePieceFaceProps) {
  if (kind === "daughter") {
    return (
      <span
        className={`flex size-full items-center justify-center rounded-[2.4cqw] ${hakoiriMusumeToneClassNames.daughterPiece}`}
      >
        <span
          className={`font-['Hiragino_Mincho_ProN','Yu_Mincho','Noto_Serif_JP',serif] text-[17cqw] leading-none ${hakoiriMusumeToneClassNames.daughterMark}`}
        >
          娘
        </span>
      </span>
    );
  }
  return (
    <span
      className={`block size-full rounded-[2.4cqw] ${hakoiriMusumeToneClassNames.woodPiece}`}
    />
  );
}

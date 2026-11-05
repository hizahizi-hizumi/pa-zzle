import type { CSSProperties, ReactNode, Ref } from "react";

import { tsumeShogiBoardFrameStyle } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiPieceBox } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiPieceBox";

/**
 * 盤の幅。盤の木の縁（`tsumeShogiBoardFrameStyle`）を含め、升は実物の盤と同じ縦長（横 35.2 : 縦 38.6）。
 * 盤の上下に玉方の駒箱の札・攻方の駒台（`--piece-box-height`・`--komadai-height`）、その下に直前の手（1.25rem）を置き、
 * 隙間を除いた高さと、左右の余白（`--board-gutter`）を除いた幅のどちらにも収まる大きさにする。PC では 40rem まで広げる。
 * 盤を置く欄（`container-type: size`）に付ける。
 */
export const tsumeShogiBoardGroupSizeStyle = {
  ...tsumeShogiBoardFrameStyle,
  "--board-chrome":
    "calc(var(--piece-box-height) + var(--komadai-height) + 1.25rem + 3 * 0.25rem)",
  "--board-width":
    "min(calc(100cqw - 2 * var(--board-gutter)), calc((100cqh - var(--board-chrome) - 2 * var(--board-frame)) * 352 / 386 + 2 * var(--board-frame)), 40rem)",
} as CSSProperties;

type TsumeShogiBoardGroupProps = {
  board: ReactNode;
  /** 攻方の駒台（`TsumeShogiHand`）。 */
  hand: ReactNode;
  /** 盤の下の1行（`TsumeShogiPlayStatus`）。 */
  status: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

/** 玉方の駒箱の札・盤・攻方の駒台・直前の手の行を、盤の幅の中に縦に並べる。プレイ画面とチュートリアルで同じ並びにする。 */
export function TsumeShogiBoardGroup({
  board,
  hand,
  status,
  ref,
}: TsumeShogiBoardGroupProps) {
  return (
    <div ref={ref} className="flex w-(--board-width) flex-col gap-1">
      <div className="h-(--piece-box-height)">
        <TsumeShogiPieceBox />
      </div>
      <div className="relative h-[calc((var(--board-width)-2*var(--board-frame))*386/352+2*var(--board-frame))]">
        {board}
      </div>
      <div className="h-(--komadai-height)">{hand}</div>
      <div className="relative h-5">{status}</div>
    </div>
  );
}

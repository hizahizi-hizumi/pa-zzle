import type { CSSProperties, ReactNode } from "react";

import { TsumeShogiPieceBox } from "@/games/tsume-shogi/ui/TsumeShogiBoardGroup/TsumeShogiPieceBox";

/**
 * 盤の縁と表記の寸法。盤の木の四辺に同じ幅の縁（`--board-frame`）を取り、上の縁に筋、右の縁に段を書く。
 * 四辺が同じ幅なので、盤の木そのものが左右の中央に来る。幅の広い画面ほど縁を太くする。
 * 320px でも盤を画面の縁に付けず、卓に置いた盤に見える余白を左右に残す（`--board-gutter`）。
 * 盤の大きさもこの部品で決める。
 * `--board-thickness` は盤の手前に見える側面の高さ。升を歪めず、天面の下に足す。
 * `--piece-box-height`・`--komadai-height` は盤の上下の駒箱の札・駒台の欄の高さ、`--komadai-gap` は盤と駒台の間。
 */
const tsumeShogiBoardFrameStyle = {
  "--board-gutter": "clamp(4px, calc(4px + (100cqw - 320px) / 35), 6px)",
  "--board-frame": "clamp(12px, calc(12px + (100cqw - 320px) / 35), 14px)",
  "--board-thickness": "clamp(5px, calc(5px + (100cqw - 320px) / 40), 8px)",
  "--piece-box-height": "1.5rem",
  "--komadai-height": "3.75rem",
  "--komadai-gap": "10px",
} as CSSProperties;

/**
 * 盤の幅。盤の木の縁（`tsumeShogiBoardFrameStyle`）を含め、升は実物の盤と同じ縦長（横 35.2 : 縦 38.6）。
 * 盤の高さには手前に見える側面（`--board-thickness`）を含める。
 * 盤の上下に玉方の駒箱の札・攻方の駒台（`--piece-box-height`・`--komadai-height`）、その下に直前の手（1.25rem）を置き、
 * 隙間を除いた高さと、左右の余白（`--board-gutter`）を除いた幅のどちらにも収まる大きさにする。PC では 40rem まで広げる。
 * 親の盤を置く欄（`container-type: size`）の寸法を参照する。
 */
const tsumeShogiBoardGroupSizeStyle = {
  ...tsumeShogiBoardFrameStyle,
  "--board-chrome":
    "calc(var(--board-thickness) + var(--piece-box-height) + var(--komadai-height) + 1.25rem + 3 * 0.25rem)",
  "--board-width":
    "min(calc(100cqw - 2 * var(--board-gutter)), calc((100cqh - var(--board-chrome) - 2 * var(--board-frame)) * 352 / 386 + 2 * var(--board-frame)), 40rem)",
} as CSSProperties;

type TsumeShogiBoardGroupProps = {
  board: ReactNode;
  hand: ReactNode;
  status: ReactNode;
  context?: "play" | "tutorial";
};

/** プレイ画面とチュートリアルで同じ並びにする。 */
export function TsumeShogiBoardGroup({
  board,
  hand,
  status,
  context = "play",
}: TsumeShogiBoardGroupProps) {
  return (
    <div
      className="flex w-(--board-width) flex-col gap-1"
      style={
        context === "tutorial"
          ? ({
              ...tsumeShogiBoardGroupSizeStyle,
              "--board-gutter": "0px",
            } as CSSProperties)
          : tsumeShogiBoardGroupSizeStyle
      }
    >
      <div className="h-(--piece-box-height)">
        <TsumeShogiPieceBox />
      </div>
      <div className="relative h-[calc((var(--board-width)-2*var(--board-frame))*386/352+2*var(--board-frame)+var(--board-thickness))]">
        {board}
      </div>
      <div className="h-(--komadai-height)">{hand}</div>
      <div className="relative h-5">{status}</div>
    </div>
  );
}

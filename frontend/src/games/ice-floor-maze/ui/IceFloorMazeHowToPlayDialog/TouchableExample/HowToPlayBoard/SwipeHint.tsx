import type { CSSProperties } from "react";

import {
  HowToPlayPressHint,
  type HowToPlayPressHintCorner,
} from "@/components/HowToPlayPressHint";
import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
  iceFloorMazeDirectionVectors,
} from "@/games/ice-floor-maze/ui/board/board-geometry";

type SwipeHintProps = {
  board: IceFloorMazeBoard;
  /** 駒のいるマス。 */
  position: number;
  direction: IceFloorMazeDirection;
  /** その向きへ1マスも動けないか。動けない手では、矢印をすぐ隣の止め役に重ねず、駒の枠の内側の短い矢じりにする。 */
  blocked: boolean;
};

/**
 * 向きの矢印の色。盤面はテーマで色を変えない明るい氷なので、共通の手がかりを明るい地（`ground="light"`）で描き、
 * 矢印もその破線の枠と同じ色にして、枠と矢印を1つの手がかりとして読ませる。
 */
const ARROW_COLOR = "rgba(0, 0, 0, 0.7)";

/**
 * 滑らせる向きの矢印。駒のマスの縁から、隣のマスの中ほどまで伸ばす。
 * 動けない手では、隣のマスの止め役（岩・もろい岩・塊など）を指して「押せ」と読めないよう、駒と枠の間に矢じりだけを置く。
 */
const ARROW_START = 0.5;
const ARROW_END = 0.95;
const BLOCKED_ARROW_END = 0.46;
const ARROW_STROKE = 0.07;
const ARROW_HEAD = 0.16;

/**
 * 指を置く角。駒のマスの、矢印と反対の側の角に、半分を外へ出して置く。右へは左下、左と上へは右下、下へは右上。
 * マスの内側の角に置くと、狭い画面では下限の大きさ（14px）の指が駒の玉にかかるので、外の角に置く。
 * 角の外へ出るのは指の半分だけで、隣のマスの角に少しかかるだけなので、例の盤面の物（岩・雪・塊・ゴールの印）は、
 * 手がかりを出す姿で駒のマスの、矢印と反対の側の角の隣に置かない。
 */
const pointerCorners = {
  up: "bottom-right",
  right: "bottom-left",
  down: "top-right",
  left: "bottom-right",
} as const satisfies Record<IceFloorMazeDirection, HowToPlayPressHintCorner>;

/** 駒のマスの置き場所。盤面の外壁を含めた描画範囲に対する割合で置く。 */
function getCellBoxStyle(
  board: IceFloorMazeBoard,
  position: number,
): CSSProperties {
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const { x, y } = getIceFloorMazeCellPosition(board, position);
  return {
    left: `${((x - viewBox.minX) / viewBox.width) * 100}%`,
    top: `${((y - viewBox.minY) / viewBox.height) * 100}%`,
    width: `${(1 / viewBox.width) * 100}%`,
    height: `${(1 / viewBox.height) * 100}%`,
  };
}

/**
 * 次に滑らせる向きの手がかり。駒のマスを共通の手がかり（破線の枠と指）で囲み、枠の縁から滑らせる向きへ矢印を伸ばす。
 * 盤面と同じ座標で、盤面の上に重ねる。押す物ではないので、指やマウスの操作は下の盤面へ通す。
 * 手がかりの大きさは、例のマスの大きさ（`--ice-floor-maze-figure-cell`）を単位にして決める。
 */
export function SwipeHint({
  board,
  position,
  direction,
  blocked,
}: SwipeHintProps) {
  const viewBox = getIceFloorMazeBoardViewBox(board);
  const center = getIceFloorMazeCellCenter(board, position);
  const vector = iceFloorMazeDirectionVectors[direction];
  const start = {
    x: center.x + vector.x * ARROW_START,
    y: center.y + vector.y * ARROW_START,
  };
  const endRatio = blocked ? BLOCKED_ARROW_END : ARROW_END;
  const end = {
    x: center.x + vector.x * endRatio,
    y: center.y + vector.y * endRatio,
  };
  // 矢じりは、矢印の先から向きと逆へ戻った所の左右に開く。
  const across = { x: -vector.y, y: vector.x };
  const headBase = {
    x: end.x - vector.x * ARROW_HEAD,
    y: end.y - vector.y * ARROW_HEAD,
  };
  const head = [
    end,
    {
      x: headBase.x + across.x * ARROW_HEAD * 0.7,
      y: headBase.y + across.y * ARROW_HEAD * 0.7,
    },
    {
      x: headBase.x - across.x * ARROW_HEAD * 0.7,
      y: headBase.y - across.y * ARROW_HEAD * 0.7,
    },
  ];
  return (
    <div
      aria-hidden="true"
      data-swipe-hint={direction}
      data-swipe-hint-blocked={blocked ? "" : undefined}
      className="pointer-events-none absolute inset-0 [--how-to-play-unit:var(--ice-floor-maze-figure-cell)]"
    >
      <span className="absolute" style={getCellBoxStyle(board, position)}>
        <HowToPlayPressHint
          frame="inside"
          outline="rounded"
          pointer="outside-corner"
          corner={pointerCorners[direction]}
          ground="light"
        />
      </span>
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className="absolute inset-0 size-full overflow-visible"
      >
        {blocked ? null : (
          <line
            data-hint-arrow=""
            x1={start.x}
            y1={start.y}
            x2={headBase.x}
            y2={headBase.y}
            stroke={ARROW_COLOR}
            strokeWidth={ARROW_STROKE}
            strokeLinecap="round"
          />
        )}
        <polygon
          data-hint-arrowhead=""
          points={head.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill={ARROW_COLOR}
          stroke={ARROW_COLOR}
          strokeWidth={ARROW_STROKE * 0.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

import { memo } from "react";

import {
  getZukanStamp,
  type ZukanChangeStage,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import {
  getZukanPiecePath,
  ZUKAN_PIECE_GROOVE_WIDTH,
  ZUKAN_PIECE_VIEW_BOX,
  type ZukanPieceShape,
} from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import {
  describeZukanProblem,
  getZukanProblemStatusColorClassName,
  isZukanPlacedStatus,
  ZUKAN_PIECE_RECESS_ID,
  ZUKAN_PIECE_SHEEN_ID,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import {
  getZukanProblemStatus,
  type ZukanProblem,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

type ZukanProblemSquareProps = {
  problem: ZukanProblem;
  /** 台紙に番号の順で置いた中の位置。押した・矢印で動いたマスと、変化を押すマスを台紙が見分けるのに使う。 */
  index: number;
  /** 台紙に並べた位置が決める、ピースの形。 */
  pieceShape: ZukanPieceShape;
  numberDigitCount: number;
  /** 台紙へ Tab で入ったときにフォーカスを受けるマスか。 */
  isTabStop: boolean;
  isSelected: boolean;
  /** 絞り込みの条件に当たらなかったか。台紙は、当たらなかったマスを `data-filtered-out` で見分けて後ろへ並べる。 */
  isFilteredOut: boolean;
  /** この台紙を開いて見せる、前回からの変化。無ければ `null`。 */
  change: ZukanProblemChange | null;
  /** 変化を今どこまで見せたか。見せる変化が無ければ `null`。 */
  changeStage: ZukanChangeStage | null;
};

/** 選んだピースを囲む線と、ホバーとフォーカスの線の太さ。どれもピースの1辺に対する比。 */
const SELECTION_LINE_WIDTH = 0.04;
const HOVER_LINE_WIDTH = 0.05;

/** 置いたピースの縁の線と、その内側に沿わせる照りの線の太さ。ピースの1辺に対する比。 */
const PLACED_EDGE_WIDTH = 0.022;
const PLACED_HIGHLIGHT_WIDTH = 0.03;

/** 凹みの輪郭の、彫った線の下に沿わせる明るい線のずれ。ピースの1辺に対する比。 */
const ENGRAVING_OFFSET = "translate(0.02 0.035)";
/** 置いたピースの照りの線を、左上の縁の内側へ寄せるずれ。右下の縁では隣のピースが覆う。 */
const HIGHLIGHT_OFFSET = "translate(0.025 0.035)";

/** 選んだ、置いたピースを台から持ち上げる動き。影は持ち上げた1枚にだけ付ける。全ピースに付けると、スクロールが重くなる。 */
const LIFT_CLASS_NAME =
  "origin-center transition-[transform,filter] duration-(--duration-fast) ease-standard [transform-box:fill-box]";
const LIFTED_CLASS_NAME =
  "-translate-y-[6%] scale-[1.08] [filter:drop-shadow(0_0.1em_0.08em_rgb(0_0_0/0.35))]";

/** ピースの中央に載せる問題の番号。置いたピースでは塗りを濃くした色で刷り、空きでは台に彫る。 */
const NUMBER_CLASS_NAME =
  "text-[0.2px] font-semibold tabular-nums [dominant-baseline:central] [text-anchor:middle]";
const PLACED_NUMBER_CLASS_NAME =
  "fill-[color-mix(in_oklab,currentColor_45%,black)] opacity-70";
const EMPTY_NUMBER_CLASS_NAME = "fill-(--zukan-groove,var(--border))";

/** ピースを描く SVG を、マスの2倍の大きさでマスと中心を揃えて置く。 */
const PIECE_LAYER_CLASS_NAME =
  "pointer-events-none absolute -top-1/2 -left-1/2 size-[200%] overflow-visible";

/**
 * 台紙の1問のマス。台紙が並べた位置で決めたジグソーのピースの形に描き、状態を塗りで示し、問題の番号を載せる。ほかの文字は読み上げ名に持たせる。
 * ピースは SVG の図形で描く。画像で切り抜くと、画素の細かい画面でも等倍で描かれてぼやけるため。
 * 押す・矢印キーの操作は台紙がまとめて受けるので、マス自身はイベントを持たない。
 * 前回からの変化は、マスに着くまで前回の姿で描く。押していく演出が動かす押す姿・浮いた影を、押し終えるまで重ねておく。
 * 段階が上がったマスは、押す姿に前の段階の色を重ね、落ちながら今の色へ塗り替えられるようにする。
 * 押していく演出が押し方を決められるよう、変化したマスに今の段階と段階が上がったか、ピースの形を持たせる。
 * 動きを減らす設定では今の姿に印を載せる。
 * 絞り込みの条件に当たらなかったマスは、色を変えずに薄くする。選んでいる間は、選んだことが分かるよう薄くしない。
 * 選んだピースは前景色の線で囲む。置いたピースは台から持ち上げて影を落とし、抜けた跡に凹みを見せる。空きには持ち上げるピースが無いので、囲むだけにする。
 */
function ZukanProblemSquareContent({
  problem,
  index,
  pieceShape,
  numberDigitCount,
  isTabStop,
  isSelected,
  isFilteredOut,
  change,
  changeStage,
}: ZukanProblemSquareProps) {
  const status = getZukanProblemStatus(problem);
  const isPending = changeStage === "waiting" || changeStage === "stamping";
  const hasStamp = isPending || changeStage === "landed";
  const shownStatus =
    change !== null && isPending ? change.previousStatus : status;
  const path = getZukanPiecePath(pieceShape);
  const isPlaced = isZukanPlacedStatus(shownStatus);

  // 選んだピースの囲みとホバー・フォーカスの線は隣のピースへはみ出すので、そのピースを手前に重ねる。選んだピースは、隣のホバーより手前に置く。
  // 重ね順は台紙の中に閉じ（台紙が `isolate`）、台紙の外の選んだ問題の欄やレベルのカードより手前には出ない。
  const layerClassName = isSelected ? "z-20" : "hover:z-10 focus-visible:z-10";
  // 押す姿はマスより大きく浮くので、選んだマスも含めて周りのマスより手前に重ねる。着いたあとは重なりを戻す。
  const stampClassName = changeStage === "stamping" ? "z-30" : "";
  const filteredOutClassName = isFilteredOut && !isSelected ? "opacity-30" : "";
  const description = describeZukanProblem(problem, numberDigitCount, change);
  const stamp = change === null ? null : getZukanStamp(problem, change);

  return (
    <button
      type="button"
      data-index={index}
      data-piece-shape={pieceShape}
      data-change-stage={changeStage ?? undefined}
      data-change-level={stamp?.level}
      data-change-raised={stamp?.isRaised ? "" : undefined}
      data-filtered-out={isFilteredOut ? "" : undefined}
      tabIndex={isTabStop ? 0 : -1}
      aria-label={
        isFilteredOut ? `${description} 絞り込みの条件外` : description
      }
      aria-current={isSelected ? "true" : undefined}
      className={`group relative size-[var(--zukan-piece-size,--spacing(16))] scroll-m-3 text-[length:var(--zukan-piece-size,--spacing(16))] outline-none ${layerClassName} ${stampClassName} ${filteredOutClassName}`}
    >
      <svg
        aria-hidden="true"
        viewBox={ZUKAN_PIECE_VIEW_BOX}
        className={`${PIECE_LAYER_CLASS_NAME} ${getZukanProblemStatusColorClassName(shownStatus)}`}
      >
        {isSelected && isPlaced && (
          <path d={path} className="fill-(--zukan-recess,var(--muted))" />
        )}
        <g
          className={`${LIFT_CLASS_NAME} ${isSelected && isPlaced ? LIFTED_CLASS_NAME : ""}`}
        >
          <path d={path} fill="currentColor" />
          {isPlaced ? (
            <>
              <path
                d={path}
                fill={`url(#${ZUKAN_PIECE_SHEEN_ID})`}
                stroke="none"
              />
              <path
                d={path}
                fill="none"
                transform={HIGHLIGHT_OFFSET}
                className="stroke-white/45"
                strokeWidth={PLACED_HIGHLIGHT_WIDTH}
                strokeLinejoin="round"
              />
              <path
                d={path}
                fill="none"
                className="stroke-[color-mix(in_oklab,currentColor_62%,black)]"
                strokeWidth={PLACED_EDGE_WIDTH}
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <path
                d={path}
                fill={`url(#${ZUKAN_PIECE_RECESS_ID})`}
                stroke="none"
              />
              <path
                d={path}
                fill="none"
                transform={ENGRAVING_OFFSET}
                className="stroke-white/50"
                strokeWidth={ZUKAN_PIECE_GROOVE_WIDTH}
                strokeLinejoin="round"
              />
              <path
                d={path}
                fill="none"
                className="stroke-(--zukan-groove,var(--border))"
                strokeWidth={ZUKAN_PIECE_GROOVE_WIDTH}
                strokeLinejoin="round"
              />
            </>
          )}
          <text
            x="0.5"
            y="0.5"
            className={`${NUMBER_CLASS_NAME} ${isPlaced ? PLACED_NUMBER_CLASS_NAME : EMPTY_NUMBER_CLASS_NAME}`}
          >
            {problem.number}
          </text>
          <path
            d={path}
            fill="none"
            className={
              isSelected
                ? "stroke-foreground"
                : "stroke-ring opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }
            strokeWidth={isSelected ? SELECTION_LINE_WIDTH : HOVER_LINE_WIDTH}
            strokeLinejoin="round"
          />
        </g>
      </svg>
      {hasStamp && (
        <svg
          aria-hidden="true"
          data-stamp-part="shadow"
          viewBox={ZUKAN_PIECE_VIEW_BOX}
          className={`${PIECE_LAYER_CLASS_NAME} text-black opacity-0 blur-[3px]`}
        >
          <path d={path} fill="currentColor" />
        </svg>
      )}
      {hasStamp && (
        <span
          aria-hidden="true"
          data-stamp-part="face"
          className={`${PIECE_LAYER_CLASS_NAME} opacity-0 ${getZukanProblemStatusColorClassName(status)}`}
        >
          <svg viewBox={ZUKAN_PIECE_VIEW_BOX} className="size-full">
            <path d={path} fill="currentColor" />
            {change?.kind === "raised" && (
              <path
                data-stamp-part="previous"
                d={path}
                fill="currentColor"
                className={getZukanProblemStatusColorClassName(
                  change.previousStatus,
                )}
              />
            )}
            <path
              d={path}
              fill={`url(#${ZUKAN_PIECE_SHEEN_ID})`}
              stroke="none"
            />
            <path
              d={path}
              fill="none"
              transform={HIGHLIGHT_OFFSET}
              className="stroke-white/45"
              strokeWidth={PLACED_HIGHLIGHT_WIDTH}
              strokeLinejoin="round"
            />
            <path
              d={path}
              fill="none"
              className="stroke-[color-mix(in_oklab,currentColor_62%,black)]"
              strokeWidth={PLACED_EDGE_WIDTH}
              strokeLinejoin="round"
            />
            <text
              x="0.5"
              y="0.5"
              className={`${NUMBER_CLASS_NAME} ${PLACED_NUMBER_CLASS_NAME}`}
            >
              {problem.number}
            </text>
          </svg>
        </span>
      )}
      {changeStage === "marked" && (
        <span
          aria-hidden="true"
          data-change-mark=""
          className="absolute inset-0 m-auto size-1.5 rounded-full bg-(--zukan-tray,var(--card))"
        />
      )}
    </button>
  );
}

export const ZukanProblemSquare = memo(ZukanProblemSquareContent);

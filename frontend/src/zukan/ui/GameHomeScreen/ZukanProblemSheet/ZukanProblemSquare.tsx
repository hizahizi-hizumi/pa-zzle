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

/** 選んだピースの周りを空ける幅と、その外を囲む線の太さ。ホバーとフォーカスの線の太さ。どれもピースの1辺に対する比。 */
const SELECTION_HALO_WIDTH = 0.2;
const SELECTION_LINE_WIDTH = 0.083;
const HOVER_LINE_WIDTH = 0.11;

/** ピースを描く SVG を、マスの2倍の大きさでマスと中心を揃えて置く。 */
const PIECE_LAYER_CLASS_NAME =
  "pointer-events-none absolute -top-1/2 -left-1/2 size-[200%] overflow-visible";

/**
 * 台紙の1問のマス。未挑戦は静かな空き位置として示し、挑戦・クリアして初めてピースの形を見せる。
 * 選択・ホバーした未挑戦の位置にはピースの形を現し、どの問題を選んだかを明確にする。
 * ピースは SVG の図形で描く。画像で切り抜くと、画素の細かい画面でも等倍で描かれてぼやけるため。
 * 押す・矢印キーの操作は台紙がまとめて受けるので、マス自身はイベントを持たない。
 * 前回からの変化は、マスに着くまで前回の姿で描く。押していく演出が動かす押す姿・浮いた影を、押し終えるまで重ねておく。
 * 段階が上がったマスは、押す姿に前の段階の色を重ね、落ちながら今の色へ塗り替えられるようにする。
 * 押していく演出が押し方を決められるよう、変化したマスに今の段階と段階が上がったか、ピースの形を持たせる。
 * 動きを減らす設定では今の姿に印を載せる。
 * 絞り込みの条件に当たらなかったマスは、色を変えずに薄くする。選んでいる間は、選んだことが分かるよう薄くしない。
 * 選んだピースは、周りを背景の色で空けて前景色の線で囲む。`ring` の明るさの線は、小さなピースでは塗りに紛れるため。
 * ピース間の溝は背景とピースの中間色にする。全問の未挑戦ピースを塗りつぶすと、膨大な問題集では図鑑が灰色の模様に見える。
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
  const isLifted = changeStage === "stamping" || changeStage === "landed";
  const shownStatus =
    change !== null && isPending ? change.previousStatus : status;
  const path = getZukanPiecePath(pieceShape);
  const isUntouched = shownStatus === "untouched";

  // 選んだピースの囲みとホバー・フォーカスの線は隣のピースへはみ出すので、そのピースを手前に重ねる。選んだピースは、隣のホバーより手前に置く。
  // 重ね順は台紙の中に閉じ（台紙が `isolate`）、台紙の外の詳細やレベルのカードより手前には出ない。
  const layerClassName = isSelected ? "z-20" : "hover:z-10 focus-visible:z-10";
  // 押す姿はマスより大きく浮くので、選んだマスも含めて周りのマスより手前に重ねる。
  const stampClassName = isLifted ? "z-30" : "";
  const filteredOutClassName = isFilteredOut && !isSelected ? "opacity-30" : "";
  const description = describeZukanProblem(problem, numberDigitCount, change);
  const stamp = change === null ? null : getZukanStamp(problem, change);

  return (
    <button
      type="button"
      data-index={index}
      data-piece-shape={pieceShape}
      data-problem-status={shownStatus}
      data-change-stage={changeStage ?? undefined}
      data-change-level={stamp?.level}
      data-change-raised={stamp?.isRaised ? "" : undefined}
      data-filtered-out={isFilteredOut ? "" : undefined}
      tabIndex={isTabStop ? 0 : -1}
      aria-label={
        isFilteredOut ? `${description} 絞り込みの条件外` : description
      }
      aria-current={isSelected ? "true" : undefined}
      className={`group relative size-6 scroll-m-3 outline-none sm:size-6.5 ${layerClassName} ${stampClassName} ${filteredOutClassName}`}
    >
      {isUntouched && (
        <span
          aria-hidden="true"
          data-empty-slot=""
          className={`pointer-events-none absolute inset-0 m-auto size-[5px] rounded-full bg-current ${getZukanProblemStatusColorClassName("untouched")} ${isSelected ? "opacity-0" : "group-hover:opacity-0 group-focus-visible:opacity-0"}`}
        />
      )}
      <svg
        aria-hidden="true"
        viewBox={ZUKAN_PIECE_VIEW_BOX}
        className={`${PIECE_LAYER_CLASS_NAME} ${getZukanProblemStatusColorClassName(shownStatus)} ${isUntouched && !isSelected ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" : ""}`}
      >
        {isSelected && (
          <path
            d={path}
            className="fill-background stroke-background"
            strokeWidth={SELECTION_HALO_WIDTH}
            strokeLinejoin="round"
          />
        )}
        <path
          d={path}
          fill="currentColor"
          className="stroke-[color-mix(in_oklab,var(--background)_50%,currentColor)]"
          strokeWidth={ZUKAN_PIECE_GROOVE_WIDTH}
          strokeLinejoin="round"
        />
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
      </svg>
      {hasStamp && (
        <svg
          aria-hidden="true"
          data-stamp-part="shadow"
          viewBox={ZUKAN_PIECE_VIEW_BOX}
          className={`${PIECE_LAYER_CLASS_NAME} translate-y-[3px] text-black/35 opacity-0 blur-[2px]`}
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
            <path
              d={path}
              fill="currentColor"
              className="stroke-[color-mix(in_oklab,var(--background)_50%,currentColor)]"
              strokeWidth={ZUKAN_PIECE_GROOVE_WIDTH}
              strokeLinejoin="round"
            />
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
          </svg>
        </span>
      )}
      {changeStage === "marked" && (
        <span
          aria-hidden="true"
          data-change-mark=""
          className="absolute inset-0 m-auto size-1.5 rounded-full bg-background"
        />
      )}
    </button>
  );
}

export const ZukanProblemSquare = memo(ZukanProblemSquareContent);

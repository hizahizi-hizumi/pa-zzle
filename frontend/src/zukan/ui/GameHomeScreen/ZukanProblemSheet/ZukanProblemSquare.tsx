import { memo } from "react";

import { getGameResultStyle } from "@/components/game-result-style";
import type { ZukanChangeStage } from "@/zukan/ui/GameZukanScreen/zukan-change-reveal";
import {
  describeZukanProblem,
  getZukanProblemStatusClassName,
} from "@/zukan/ui/GameZukanScreen/zukan-problem-appearance";
import {
  getZukanProblemStatus,
  type ZukanProblem,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

type ZukanProblemSquareProps = {
  problem: ZukanProblem;
  /** 台紙に番号の順で置いた中の位置。押した・矢印で動いたマスと、変化を押すマスを台紙が見分けるのに使う。 */
  index: number;
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

/**
 * 台紙の1問のマス。状態を塗りと枠だけで示し、文字は読み上げ名に持たせる。
 * 押す・矢印キーの操作は台紙がまとめて受けるので、マス自身はイベントを持たない。
 * 前回からの変化は、マスに着くまで前回の姿で描く。押していく演出が動かす押す姿・浮いた影・輪を、押し終えるまで重ねておく。
 * 動きを減らす設定では今の姿に印を載せる。
 * 絞り込みの条件に当たらなかったマスは、色を変えずに薄くする。選んでいる間は、選んだことが分かるよう薄くしない。
 */
function ZukanProblemSquareContent({
  problem,
  index,
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

  // `ring` の明るさでは小さなマスの選択が塗りに紛れるので、選んだマスは前景色の輪郭で示す。
  // 輪郭はマスの間の隙間より外へ出て、後に描く右・下のマスに覆われるので、輪郭のあるマスを手前に重ねる。選んだマスの輪郭は、隣のマスのホバーより手前に置く。
  // 重ね順は台紙の中に閉じ（台紙が `isolate`）、台紙の外の詳細やタブより手前には出ない。
  const selectionClassName = isSelected
    ? "z-20 outline-2 outline-foreground"
    : "hover:z-10 hover:outline-2 hover:outline-ring focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring";
  // 押す姿はマスより大きく浮くので、選んだマスも含めて周りのマスより手前に重ねる。
  const stampClassName = isLifted ? "z-30" : "";
  const filteredOutClassName = isFilteredOut && !isSelected ? "opacity-30" : "";
  const description = describeZukanProblem(problem, numberDigitCount, change);
  const ringColorClassName =
    status === "attempted" || status === "untouched"
      ? ""
      : getGameResultStyle(status).scoreClassName;

  return (
    <button
      type="button"
      data-index={index}
      data-change-stage={changeStage ?? undefined}
      data-filtered-out={isFilteredOut ? "" : undefined}
      tabIndex={isTabStop ? 0 : -1}
      aria-label={
        isFilteredOut ? `${description} 絞り込みの条件外` : description
      }
      aria-current={isSelected ? "true" : undefined}
      className={`relative size-3.5 scroll-m-3 outline-offset-1 sm:size-4 ${getZukanProblemStatusClassName(shownStatus)} ${selectionClassName} ${stampClassName} ${filteredOutClassName}`}
    >
      {hasStamp && (
        <>
          <span
            aria-hidden="true"
            data-stamp-part="ring"
            className={`pointer-events-none absolute inset-0 border-2 border-current opacity-0 ${ringColorClassName}`}
          />
          <span
            aria-hidden="true"
            data-stamp-part="face"
            className={`pointer-events-none absolute inset-0 opacity-0 ${getZukanProblemStatusClassName(status)}`}
          >
            <span
              data-stamp-part="shadow"
              className="absolute inset-0 opacity-0 shadow-[0_3px_5px_rgb(0_0_0/0.35)]"
            />
          </span>
        </>
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

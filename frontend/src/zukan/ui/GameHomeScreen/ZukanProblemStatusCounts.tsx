import {
  getZukanProblemStatusClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

type ZukanProblemStatusCountsProps = {
  /** 台紙の問題の、状態ごとの数。 */
  counts: Readonly<Record<ZukanProblemStatus, number>>;
};

/**
 * 台紙の問題の数を、評価段階ごとと挑戦中・未挑戦に分け、マスと同じ見本と数字だけで示す。数を足すとその台紙の全問の数になる。
 * 状態の名前は読み上げにだけ持たせ、見方で確かめる。数の無い状態も並べ、並びを保つ。割合と称賛の言葉は付けない。
 */
export function ZukanProblemStatusCounts({
  counts,
}: ZukanProblemStatusCountsProps) {
  return (
    <ul
      aria-label="状態ごとの問題の数"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta"
    >
      {zukanProblemStatusOrder.map((status) => (
        <li
          key={status}
          aria-label={`${zukanProblemStatusLabels[status]} ${counts[status]}問`}
          className="flex items-center gap-1 whitespace-nowrap"
        >
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 ${getZukanProblemStatusClassName(status)}`}
          />
          <span className="font-medium text-foreground tabular-nums">
            {counts[status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

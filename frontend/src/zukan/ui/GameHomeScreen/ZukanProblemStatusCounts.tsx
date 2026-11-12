import {
  getZukanProblemStatusColorClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

type ZukanProblemStatusCountsProps = {
  /** 台紙の問題の、状態ごとの数。 */
  counts: Readonly<Record<ZukanProblemStatus, number>>;
};

/**
 * 台紙の問題の数を、評価段階ごとと挑戦中・未挑戦に分け、マスと同じ見本と数字で示す。数を足すとその台紙の全問の数になる。
 * 台紙を狭めないよう、狭い幅では見本と数字だけを1行に並べ、状態の名前は読み上げにだけ持たせて見方で確かめる。
 * 横の列に置く PC の幅では、1行に1つの状態を名前と一緒に並べる。数の無い状態も並べ、並びを保つ。割合と称賛の言葉は付けない。
 */
export function ZukanProblemStatusCounts({
  counts,
}: ZukanProblemStatusCountsProps) {
  return (
    <ul
      aria-label="状態ごとの問題の数"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta lg:w-full lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-y-2 lg:text-supporting"
    >
      {zukanProblemStatusOrder.map((status) => (
        <li
          key={status}
          aria-label={`${zukanProblemStatusLabels[status]} ${counts[status]}問`}
          className="flex items-center gap-1 whitespace-nowrap lg:gap-2"
        >
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 bg-current ${getZukanProblemStatusColorClassName(status)}`}
          />
          <span
            aria-hidden="true"
            className="hidden text-muted-foreground lg:inline"
          >
            {zukanProblemStatusLabels[status]}
          </span>
          <span className="font-medium text-foreground tabular-nums lg:ms-auto">
            {counts[status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

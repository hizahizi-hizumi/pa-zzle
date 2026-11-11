import {
  getZukanProblemStatusColorClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

type ZukanProblemStatusCountsProps = {
  /** 台紙の問題の、状態ごとの数。 */
  counts: Readonly<Record<ZukanProblemStatus, number>>;
  /** `row` は見本と数字だけを1行に並べる。`list` は、場所に余裕のある所で、状態の名前を添えて縦に並べる。 */
  layout?: "row" | "list";
};

/**
 * 台紙の問題の数を、評価段階ごとと挑戦中・未挑戦に分け、マスと同じ見本と数字だけで示す。数を足すとその台紙の全問の数になる。
 * 状態の名前は、1行に並べるときは読み上げにだけ持たせて見方で確かめ、縦に並べるときは添える。数の無い状態も並べて並びを保ち、数字を薄くして退かせる。見本は、ゲームの地の色に紛れないよう縁を付ける。割合と称賛の言葉は付けない。
 */
export function ZukanProblemStatusCounts({
  counts,
  layout = "row",
}: ZukanProblemStatusCountsProps) {
  const isList = layout === "list";
  return (
    <ul
      aria-label="状態ごとの問題の数"
      className={
        isList
          ? "grid gap-y-1.5 text-supporting"
          : "flex flex-wrap items-center gap-x-3 gap-y-1 text-meta"
      }
    >
      {zukanProblemStatusOrder.map((status) => (
        <li
          key={status}
          aria-label={`${zukanProblemStatusLabels[status]} ${counts[status]}問`}
          className={`flex items-center whitespace-nowrap ${isList ? "gap-2" : "gap-1"}`}
        >
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 rounded-[2px] bg-current shadow-[0_0_0_1px_rgb(255_255_255/0.5),0_0_0_2px_rgb(0_0_0/0.12)] ${getZukanProblemStatusColorClassName(status)}`}
          />
          {isList && (
            <span aria-hidden="true" className="flex-1 text-foreground/65">
              {zukanProblemStatusLabels[status]}
            </span>
          )}
          <span
            className={`font-medium text-foreground tabular-nums ${counts[status] === 0 ? "opacity-40" : ""}`}
          >
            {counts[status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

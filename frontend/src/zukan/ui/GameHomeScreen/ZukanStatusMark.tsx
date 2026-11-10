import { getZukanProblemStatusColorClassName } from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

type ZukanStatusMarkProps = {
  status: ZukanProblemStatus;
  size?: "small" | "large";
};

/** 未挑戦は空き位置の点、それ以外は集まったピースの面積で示す。 */
export function ZukanStatusMark({
  status,
  size = "small",
}: ZukanStatusMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`${size === "large" ? "size-4" : "size-3"} grid shrink-0 place-items-center ${getZukanProblemStatusColorClassName(status)}`}
    >
      <span
        className={
          status === "untouched"
            ? "size-[5px] rounded-full bg-current"
            : "size-full bg-current"
        }
      />
    </span>
  );
}

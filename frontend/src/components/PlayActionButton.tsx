import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PlayActionButtonProps = {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
} & (
  | { active?: undefined; activeClassName?: undefined }
  | {
      /** 入れたり切ったりする操作で、いま入れているか。 */
      active: boolean;
      /**
       * 入れている間の地と文字の色。切り替えた入力で盤面に置くものの色をゲームが持ち、その定数を渡す。
       * 色はゲーム固有色なので、この部品は持たない。
       */
      activeClassName: string;
    }
);

/**
 * 解く場面で盤の下に並べる操作。アイコンの下に短いラベルを置く。
 * `active` を渡すと、押すたびに入れたり切ったりする操作になり、入れている間は `activeClassName` の色で示す。
 * 入れている間はホバーとフォーカスの地を重ねず、ポインタを乗せたままでも入れている色を保つ。
 */
export function PlayActionButton({
  icon,
  label,
  active,
  activeClassName,
  disabled = false,
  onClick,
}: PlayActionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-md text-muted-foreground transition-colors not-aria-pressed:hover:bg-accent/50 not-aria-pressed:hover:text-foreground focus-visible:outline-none not-aria-pressed:focus-visible:bg-accent not-aria-pressed:focus-visible:text-foreground aria-pressed:focus-visible:ring-2 aria-pressed:focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
        active && activeClassName,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true" className="[&>svg]:size-6">
        {icon}
      </span>
      <span className="text-play-meta">{label}</span>
    </button>
  );
}

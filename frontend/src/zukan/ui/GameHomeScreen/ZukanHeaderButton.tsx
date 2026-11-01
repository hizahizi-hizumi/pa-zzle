import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ZukanHeaderButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "className" | "children"
> & {
  icon: ReactNode;
  /** ボタンの名前。狭い画面では読み上げにだけ持たせる。 */
  label: string;
  /** アイコンに重ねる印。 */
  mark?: ReactNode;
};

/**
 * ゲームのホームの見出しの並び（解いた数・遊び方・見方・絞り込み）に置く、開いて補う層のボタン。
 * 狭い画面でも見出しの並びを1行に収めるよう、狭い画面では名前を読み上げにだけ持たせてアイコンで示す。
 * 印はボタンの中身の右上に重ね、印を付け外ししてもボタンの大きさを変えない。
 * 見方・絞り込みの層の引き金として、受け取った属性と操作をそのまま渡す。
 */
export function ZukanHeaderButton({
  icon,
  label,
  mark,
  ...props
}: ZukanHeaderButtonProps) {
  return (
    <Button variant="ghost" size="sm" {...props}>
      <span className="relative inline-flex items-center gap-1.5">
        {icon}
        <span className="max-sm:sr-only">{label}</span>
        {mark !== undefined && (
          <span className="absolute -top-3 -right-5">{mark}</span>
        )}
      </span>
    </Button>
  );
}

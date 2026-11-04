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
 * 印はボタンの中身の右肩に、中身と重ならないように置き、印を付け外ししてもボタンの大きさを変えない。
 * 見方・絞り込みの層の引き金として、受け取った属性と操作をそのまま渡す。
 */
export function ZukanHeaderButton({
  icon,
  label,
  mark,
  ...props
}: ZukanHeaderButtonProps) {
  return (
    // アイコンをボタンの直下に置き、アイコンを持つボタンの詰めた余白にする。狭い画面でも計数と並べるボタンを増やせる幅を残す。
    <Button variant="ghost" size="sm" {...props}>
      {icon}
      <span className="max-sm:sr-only">{label}</span>
      {mark !== undefined && (
        // 印の置き場は幅を持たせず、ボタンの間隔の分だけ戻して、見えている中身の右肩に付ける。
        <span className="relative -ms-1.5 h-4">
          <span className="absolute -top-3 left-0">{mark}</span>
        </span>
      )}
    </Button>
  );
}

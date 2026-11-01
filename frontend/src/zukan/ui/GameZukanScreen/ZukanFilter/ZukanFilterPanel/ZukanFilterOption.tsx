import type { ReactNode } from "react";

import { ToggleGroupItem } from "@/components/ui/toggle-group";

type ZukanFilterOptionProps = {
  value: string;
  label: string;
  /** 名前の前に添える見本。 */
  sample?: ReactNode;
  isSelected: boolean;
  /** この選択肢に当たる問題の数。 */
  count: number;
  /** 条件をかけないときに、この選択肢に当たる問題の数。`count` はこれを超えない。 */
  countLimit: number;
};

/**
 * 絞り込みの1つの選択肢。名前に当たる問題の数を添え、当たる問題が無ければ押せなくする。選んでいれば0でも外せる。
 * 選んでも中身を足し引きせず、数には取りうる最大の桁の場所を取っておき、選んでも数が変わってもボタンの幅を変えない。
 */
export function ZukanFilterOption({
  value,
  label,
  sample,
  isSelected,
  count,
  countLimit,
}: ZukanFilterOptionProps) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={`${label}、${count}問`}
      disabled={count === 0 && !isSelected}
    >
      {sample}
      <span className="inline-flex items-baseline gap-1.5 tabular-nums">
        {label}
        <span
          className={`inline-grid text-meta ${isSelected ? "text-primary-foreground/75" : "text-muted-foreground"}`}
        >
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1"
          >
            {"0".repeat(String(countLimit).length)}
          </span>
          <span className="col-start-1 row-start-1">{count}</span>
        </span>
      </span>
    </ToggleGroupItem>
  );
}

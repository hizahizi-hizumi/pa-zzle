import { howToPlayLabelColumnsClassName } from "@/components/how-to-play-layout";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** キーボード操作1つ。押すキーと、その操作の短い説明。 */
export type HowToPlayKey = {
  keys: readonly string[];
  description: string;
};

type HowToPlayKeyTableProps = {
  keys: readonly HowToPlayKey[];
};

/** キーボード操作の一覧。左にキーの形の小さな記号、右に短い説明を並べる。 */
export function HowToPlayKeyTable({ keys }: HowToPlayKeyTableProps) {
  return (
    // キーの列は、いちばん長いキーの組が1行に収まる幅に決めておき、どの行の説明も同じ所から書き出す。
    <dl
      className={cn(
        "grid items-center gap-y-3",
        howToPlayLabelColumnsClassName,
      )}
    >
      {keys.map(({ keys: keyNames, description }) => (
        <div key={keyNames.join("+")} className="contents">
          <dt className="flex gap-1 whitespace-nowrap">
            {keyNames.map((key) => (
              <Kbd key={key} size="body">
                {key}
              </Kbd>
            ))}
          </dt>
          <dd className="text-body">{description}</dd>
        </div>
      ))}
    </dl>
  );
}

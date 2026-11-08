import { getGameResultStyle } from "@/components/game-result-style";
import {
  type RandomProblemStatus,
  randomProblemStatuses,
} from "@/lib/random-problem-settings";

type RandomProblemStatusChecklistProps = {
  selected: readonly RandomProblemStatus[];
  onChange: (statuses: readonly RandomProblemStatus[]) => void;
};

const statusDescriptions: Record<
  RandomProblemStatus,
  { name: string; description: string }
> = {
  untouched: { name: "未挑戦", description: "プレイ記録なし" },
  attempted: { name: "挑戦中", description: "未クリア" },
  clear: { name: "clear", description: "80点未満" },
  good: { name: "good", description: "80〜89点" },
  great: { name: "great", description: "90〜99点" },
  perfect: { name: "perfect", description: "100点" },
};

const statusGroups = [
  { title: "プレイ状況", statuses: randomProblemStatuses.slice(0, 2) },
  { title: "クリア済み", statuses: randomProblemStatuses.slice(2) },
];

export function RandomProblemStatusChecklist({
  selected,
  onChange,
}: RandomProblemStatusChecklistProps) {
  function toggleStatus(status: RandomProblemStatus, checked: boolean): void {
    onChange(
      checked
        ? randomProblemStatuses.filter(
            (item) => item === status || selected.includes(item),
          )
        : selected.filter((item) => item !== status),
    );
  }

  return (
    <div role="group" aria-label="出題対象" className="grid gap-3">
      {statusGroups.map(({ title, statuses }) => (
        <div key={title} className="grid gap-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {statuses.map((status) => {
              const checked = selected.includes(status);
              const label = statusDescriptions[status];
              const resultStyle =
                status === "untouched" || status === "attempted"
                  ? null
                  : getGameResultStyle(status);
              return (
                <label
                  key={status}
                  className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/50 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-foreground"
                    checked={checked}
                    disabled={checked && selected.length === 1}
                    onChange={(event) =>
                      toggleStatus(status, event.target.checked)
                    }
                  />
                  <span
                    className={`min-w-0 flex-1 text-supporting font-medium ${resultStyle?.scoreClassName ?? ""}`}
                  >
                    {label.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {label.description}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

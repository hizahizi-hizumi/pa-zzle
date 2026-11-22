import { useWaterSortIdea } from "@/games/water-sort/ui/ideas/IdeaContext";
import {
  isWaterSortIdeaId,
  WATER_SORT_IDEAS,
} from "@/games/water-sort/ui/ideas/idea";

/** 案の切り替え。盤面を保ったまま切り替わるので、同じ問題の途中で見比べられる。 */
export function IdeaSwitcher() {
  const { idea, setIdea } = useWaterSortIdea();

  return (
    <label className="absolute top-1 left-3 z-10 flex items-center gap-1 rounded-full bg-background/85 py-1 pr-1 pl-3 text-xs text-muted-foreground shadow-raised">
      案
      <select
        aria-label="体験の案"
        value={idea}
        onChange={(event) => {
          const next = event.target.value;
          if (isWaterSortIdeaId(next)) {
            setIdea(next);
          }
        }}
        className="w-40 truncate rounded-full bg-transparent py-1 pr-1 pl-1 text-xs font-medium text-foreground"
      >
        {WATER_SORT_IDEAS.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

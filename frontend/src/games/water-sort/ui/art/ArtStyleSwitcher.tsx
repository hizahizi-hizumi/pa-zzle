import { useWaterSortArtStyle } from "@/games/water-sort/ui/art/art-registry";
import {
  setWaterSortArtStyle,
  WATER_SORT_ART_STYLES,
} from "@/games/water-sort/ui/art/art-style";

/** 絵の方向の切り替え。盤面を保ったまま切り替わるので、同じ問題の途中で見比べられる。 */
export function ArtStyleSwitcher() {
  const style = useWaterSortArtStyle();

  return (
    <label className="absolute top-1 left-3 z-10 flex items-center gap-1 rounded-full bg-background/85 py-1 pr-1 pl-3 text-xs text-muted-foreground shadow-raised">
      絵
      <select
        aria-label="絵の方向"
        value={style}
        onChange={(event) => {
          const next = WATER_SORT_ART_STYLES.find(
            ({ id }) => id === event.target.value,
          );
          if (next) setWaterSortArtStyle(next.id);
        }}
        className="w-28 truncate rounded-full bg-transparent py-1 pr-1 pl-1 text-xs font-medium text-foreground"
      >
        {WATER_SORT_ART_STYLES.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

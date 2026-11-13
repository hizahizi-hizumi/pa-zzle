// 一時の切り替え口: プレイ画面の隅に重ねる試作の選択。収束のときに消す。
import { waterSortLooks } from "@/games/water-sort/ui/prototypes/registry";
import {
  setWaterSortLookId,
  useWaterSortLookId,
} from "@/games/water-sort/ui/prototypes/use-water-sort-look";

export function WaterSortLookSelect() {
  const lookId = useWaterSortLookId();

  return (
    <select
      aria-label="見た目の試作"
      value={lookId ?? ""}
      onChange={(event) => setWaterSortLookId(event.target.value || null)}
      className="fixed bottom-2 left-2 z-[60] max-w-28 rounded border border-black/20 bg-white/85 px-1 py-0.5 text-[11px] text-black shadow-sm"
    >
      <option value="">今の画面</option>
      {waterSortLooks.map((look) => (
        <option key={look.id} value={look.id}>
          {look.label}
        </option>
      ))}
    </select>
  );
}

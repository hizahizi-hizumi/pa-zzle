import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getSyrupStyle } from "@/games/water-sort/ui/ideas/kitchen/kitchen-syrups";

type JarSyrupProps = {
  contents: WaterSortBottle;
};

type SyrupLayer = { colorIndex: number; startSlot: number; slotCount: number };

export function JarSyrup({ contents }: JarSyrupProps) {
  const layers = getSyrupLayers(contents);

  return layers.map(({ colorIndex, startSlot, slotCount }, layerIndex) => {
    const isSurface = layerIndex === layers.length - 1;

    return (
      <span
        key={`${startSlot}-${colorIndex}-${slotCount}`}
        className="absolute inset-x-0"
        style={{
          bottom: `${startSlot * 25}%`,
          height: `calc(${slotCount * 25}% + 1px)`,
          ...getSyrupStyle(colorIndex),
          // 糖の濃さの違う層の境は、上の層の下に細い明るみを置いて見せる。液面は窓の光の映り込みで明るくする。
          boxShadow: isSurface
            ? "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 5px 4px -2px rgba(255,250,235,0.35)"
            : "inset 0 1px 0 rgba(255,255,255,0.22)",
        }}
      />
    );
  });
}

/** 同じ果実のシロップが続く段は、溶け合った1つの層として描く。 */
function getSyrupLayers(contents: WaterSortBottle): SyrupLayer[] {
  const layers: SyrupLayer[] = [];
  contents.forEach(function addSlot(colorIndex, slotIndex) {
    const last = layers.at(-1);
    if (last?.colorIndex === colorIndex) {
      last.slotCount += 1;
      return;
    }
    layers.push({ colorIndex, startSlot: slotIndex, slotCount: 1 });
  });
  return layers;
}

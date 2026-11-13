import type { RackGeometry } from "@/games/water-sort/ui/prototypes/pour/PourBoard/art";

export type Slot = { cx: number; yt: number; tier: number };

export type BoardLayout = {
  key: string;
  rack: RackGeometry;
  slotWidth: number;
  slots: readonly Slot[];
  /** 単位あたりの CSS px。 */
  scale: number;
  /** 入れ物の中での立ての左上（CSS px）。 */
  left: number;
  top: number;
};

const FIRST_TIER_TOP = 46;
const TIER_SPACING = 234;
const BELOW_LAST_TIER = 226;
const MAX_SCALE = 1.1;

export function computeBoardLayout(
  bottleCount: number,
  containerWidth: number,
  containerHeight: number,
): BoardLayout {
  const columns = Math.max(3, Math.ceil(bottleCount / 2));
  const slotWidth = columns <= 4 ? 88 : columns === 5 ? 78 : 70;
  const firstCenter = 14 + Math.max(slotWidth / 2 - 3, 33);
  const width = firstCenter * 2 + (columns - 1) * slotWidth;
  const tierTops = [FIRST_TIER_TOP, FIRST_TIER_TOP + TIER_SPACING];
  const height = FIRST_TIER_TOP + TIER_SPACING + BELOW_LAST_TIER;
  const bottomCount = bottleCount - columns;
  const topHoles = Array.from(
    { length: columns },
    (_, i) => firstCenter + i * slotWidth,
  );
  const bottomOffset = ((columns - bottomCount) * slotWidth) / 2;
  const bottomHoles = Array.from(
    { length: bottomCount },
    (_, i) => firstCenter + bottomOffset + i * slotWidth,
  );
  const slots: Slot[] = [
    ...topHoles.map((cx) => ({ cx, yt: tierTops[0] ?? 0, tier: 0 })),
    ...bottomHoles.map((cx) => ({ cx, yt: tierTops[1] ?? 0, tier: 1 })),
  ];
  const scale = Math.max(
    0.2,
    Math.min(containerWidth / width, containerHeight / height, MAX_SCALE),
  );
  return {
    key: `${bottleCount}:${Math.round(scale * 1000)}`,
    rack: { width, height, tierTops, holes: [topHoles, bottomHoles] },
    slotWidth,
    slots,
    scale,
    left: (containerWidth - width * scale) / 2,
    top: (containerHeight - height * scale) / 2,
  };
}

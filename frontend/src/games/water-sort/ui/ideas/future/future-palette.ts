import {
  isCompleteWaterSortBottle,
  type WaterSortBottle,
} from "@/games/water-sort/puzzle/state";

/**
 * 液の質。暗い地の上で色相だけに頼らず見分けられるよう、光り方を変える。
 * - `clear`: 澄んで芯が明るく光る。
 * - `milky`: 乳白で芯と縁の差が小さく、表面に真珠のような照りがある。
 * - `dense`: 濃く、縁が深く沈み、光を内にこもらせる。
 */
type FutureFluidGrain = "clear" | "milky" | "dense";

export type FutureFluidView = {
  base: string;
  grain: FutureFluidGrain;
};

/** 色番号（`get-water-color-view.ts` と同じ順）ごとの、未知のエネルギー流体の発光色。 */
const futureFluids: readonly FutureFluidView[] = [
  { base: "#f0525a", grain: "clear" },
  { base: "#3d6dff", grain: "dense" },
  { base: "#2fd27c", grain: "clear" },
  { base: "#f7d548", grain: "clear" },
  { base: "#9a58f5", grain: "dense" },
  { base: "#ff9440", grain: "clear" },
  { base: "#5fdcf6", grain: "clear" },
  { base: "#f56fbf", grain: "clear" },
  { base: "#b5e54a", grain: "milky" },
  { base: "#c6b4ff", grain: "milky" },
  { base: "#dbe3ec", grain: "milky" },
  { base: "#16a596", grain: "dense" },
];

export function getFutureFluidView(colorIndex: number): FutureFluidView {
  return (
    futureFluids[colorIndex] ?? {
      base: `hsl(${(colorIndex * 47) % 360} 80% 60%)`,
      grain: "clear",
    }
  );
}

const grainShading = {
  clear: { edge: 50, core: 70, coreWhite: 42 },
  milky: { edge: 74, core: 82, coreWhite: 30 },
  dense: { edge: 38, core: 80, coreWhite: 26 },
} as const satisfies Record<
  FutureFluidGrain,
  { edge: number; core: number; coreWhite: number }
>;

/** 円柱の中の液として、縁を沈ませ芯を明るくする横向きの塗り。 */
export function getFutureFluidFill(colorIndex: number, glow = 0): string {
  const { base, grain } = getFutureFluidView(colorIndex);
  const shading = grainShading[grain];
  const edge = `color-mix(in oklab, ${base} ${shading.edge}%, #03070b)`;
  const core = `color-mix(in oklab, ${base} ${Math.max(0, shading.core - glow * 18)}%, #ffffff)`;
  const body = `color-mix(in oklab, ${base} ${100 - glow * 10}%, #ffffff)`;
  const sheen =
    grain === "milky"
      ? `, linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 38%, rgba(255,255,255,0.06) 72%, rgba(255,255,255,0))`
      : "";
  return `linear-gradient(90deg, ${edge} 0%, ${body} ${26 - shading.coreWhite / 6}%, ${core} 40%, ${core} 50%, ${body} ${70 + shading.coreWhite / 8}%, ${edge} 100%)${sheen}`;
}

/** 1本の収容管が同じ色で満ちていれば、その色番号。 */
export function getLockedColorIndex(contents: WaterSortBottle): number | null {
  return isCompleteWaterSortBottle(contents) ? (contents[0] ?? null) : null;
}

/** 下から続く同じ色の段をひとかたまりにする。場の隔てが要るのは、違う色が接する所だけ。 */
export function getFluidRuns(contents: WaterSortBottle) {
  const runs: { colorIndex: number; startSlot: number; slotCount: number }[] =
    [];
  contents.forEach((colorIndex, slot) => {
    const last = runs[runs.length - 1];
    if (last && last.colorIndex === colorIndex) {
      last.slotCount += 1;
      return;
    }
    runs.push({ colorIndex, startSlot: slot, slotCount: 1 });
  });
  return runs;
}

/** 違う色の液を隔てる場。暗い隙間の中央に、細い光の線が通る。 */
export const FIELD_BARRIER_BACKGROUND =
  "linear-gradient(180deg, rgba(2,5,8,0.85), rgba(2,5,8,0.4) 30%, rgba(214,240,255,0.75) 50%, rgba(2,5,8,0.4) 70%, rgba(2,5,8,0.85))";

/** 液面の照り。 */
export function getFluidSurfaceSheen(colorIndex: number): string {
  return `linear-gradient(180deg, color-mix(in oklab, ${getFutureFluidView(colorIndex).base} 45%, #ffffff), transparent)`;
}

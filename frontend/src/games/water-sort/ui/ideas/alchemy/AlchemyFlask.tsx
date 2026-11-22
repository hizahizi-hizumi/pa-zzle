import type { ReactNode } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { FlaskGlassBack } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask/FlaskGlassBack";
import { FlaskGlassFront } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask/FlaskGlassFront";
import { FlaskHalo } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask/FlaskHalo";
import { FlaskInnerLight } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask/FlaskInnerLight";
import { FlaskSeal } from "@/games/water-sort/ui/ideas/alchemy/AlchemyFlask/FlaskSeal";
import { ElixirBand } from "@/games/water-sort/ui/ideas/alchemy/ElixirBand";
import {
  FLASK_LIQUID_INSET,
  type FlaskShape,
} from "@/games/water-sort/ui/ideas/alchemy/flask-shapes";

type AlchemyFlaskProps = {
  contents: WaterSortBottle;
  shape: FlaskShape;
  selected?: boolean;
  /** そろって封をした姿で描く。 */
  sealed?: boolean;
  /** 封をした姿を、灯って封をする動きで見せ始める。 */
  animateSealing?: boolean;
  /** 注ぐ演出で、移っている液を重ねる。 */
  liquidOverlay?: ReactNode;
};

type ElixirRun = { colorIndex: number; startSlot: number; slotCount: number };

function getElixirRuns(contents: WaterSortBottle): ElixirRun[] {
  const runs: ElixirRun[] = [];
  contents.forEach((colorIndex, slot) => {
    const last = runs[runs.length - 1];
    if (last && last.colorIndex === colorIndex) {
      last.slotCount += 1;
    } else {
      runs.push({ colorIndex, startSlot: slot, slotCount: 1 });
    }
  });
  return runs;
}

export function AlchemyFlask({
  contents,
  shape,
  selected = false,
  sealed = false,
  animateSealing = false,
  liquidOverlay,
}: AlchemyFlaskProps) {
  const sealedColorIndex = sealed ? contents[0] : undefined;
  const inset = FLASK_LIQUID_INSET;

  return (
    <span
      aria-hidden="true"
      // 光や封は器の枠の外へはみ出すので、隣のボトルを押す邪魔をしないよう、押されるのはボタンの枠だけにする。
      className="pointer-events-none absolute inset-0 transition-[filter] duration-(--duration-normal)"
      style={{
        filter: selected
          ? "drop-shadow(0 0 5px rgba(255, 196, 120, 0.55))"
          : undefined,
      }}
    >
      {sealedColorIndex !== undefined && (
        <FlaskHalo colorIndex={sealedColorIndex} animate={animateSealing} />
      )}
      <FlaskGlassBack shape={shape} />
      <span
        className="absolute overflow-hidden"
        style={{
          left: `${inset.leftPercent}%`,
          right: `${inset.rightPercent}%`,
          top: `${inset.topPercent}%`,
          bottom: `${inset.bottomPercent}%`,
          borderRadius: "0 0 14% 14% / 0 0 5% 5%",
        }}
      >
        {getElixirRuns(contents).map((run) => (
          <ElixirBand
            key={`${run.startSlot}-${run.colorIndex}-${run.slotCount}`}
            colorIndex={run.colorIndex}
            startSlot={run.startSlot}
            slotCount={run.slotCount}
          />
        ))}
        {liquidOverlay}
        {sealedColorIndex !== undefined && (
          <FlaskInnerLight animate={animateSealing} />
        )}
      </span>
      <FlaskGlassFront shape={shape} selected={selected} />
      {sealed && <FlaskSeal shape={shape} animate={animateSealing} />}
    </span>
  );
}

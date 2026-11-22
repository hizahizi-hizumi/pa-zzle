import { useLayoutEffect, useRef } from "react";

import {
  JAR_SYRUP_BOX,
  JAR_SYRUP_RADIUS,
} from "@/games/water-sort/ui/ideas/kitchen/jar-geometry";
import { JarCover } from "@/games/water-sort/ui/ideas/kitchen/KitchenJar/JarCover";
import { JarGlassBack } from "@/games/water-sort/ui/ideas/kitchen/KitchenJar/JarGlassBack";
import { JarGlassFront } from "@/games/water-sort/ui/ideas/kitchen/KitchenJar/JarGlassFront";
import { JarSyrup } from "@/games/water-sort/ui/ideas/kitchen/KitchenJar/JarSyrup";
import { isFilledJar } from "@/games/water-sort/ui/ideas/kitchen/kitchen-jar-state";
import type { WaterBottleProps } from "@/games/water-sort/ui/ideas/overrides";

export function KitchenJar({
  contents,
  selected = false,
  waterOverlay,
  role = "board",
  concealed = false,
}: WaterBottleProps) {
  const held = selected || role === "pour-source";
  // 注ぎ終わって盤面の瓶が見えてから布をかぶせる。
  const covered = role === "board" && !concealed && isFilledJar(contents);
  // 描き始めからそろっている瓶（案の切り替えなど）は、結ぶ動きを見せずに布をかぶせた姿で出す。
  const skipTyingRef = useRef(covered);
  useLayoutEffect(() => {
    if (!covered) {
      skipTyingRef.current = false;
    }
  }, [covered]);

  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 transition-[filter] duration-(--duration-normal) ${
        held
          ? "drop-shadow-[0_6px_6px_rgba(92,64,30,0.28)] dark:drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]"
          : ""
      }`}
    >
      <JarGlassBack />
      <span
        className="absolute overflow-hidden"
        style={{ ...JAR_SYRUP_BOX, borderRadius: JAR_SYRUP_RADIUS }}
      >
        <JarSyrup contents={contents} />
        {waterOverlay}
      </span>
      <JarGlassFront held={held} />
      {covered && <JarCover skipTyingRef={skipTyingRef} />}
    </span>
  );
}

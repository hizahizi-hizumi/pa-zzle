// 試作 pour: 重さのある注ぎ。木の試験管立てに色水の試験管が並び、注ぐ量だけ深く傾けて流す。
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import {
  POUR_FLOOR_VARIABLE,
  PourBoard,
} from "@/games/water-sort/ui/prototypes/pour/PourBoard";

export function Board(props: WaterSortBoardProps) {
  return <PourBoard {...props} />;
}

/** 左上の窓から光の入る壁と、立てを置いた明るい作業台。 */
export function Background() {
  const floor = `var(${POUR_FLOOR_VARIABLE}, 78%)`;
  return (
    <div
      className="relative size-full overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 70% at 22% 18%, #f3f6f8 0%, #e6ecf0 48%, #d8e0e7 100%)",
      }}
    >
      <div
        className="absolute inset-x-0"
        style={{
          top: `calc(${floor} - 34px)`,
          bottom: 0,
          background:
            "linear-gradient(180deg, #cfd8df 0px, #dde4ea 2px, #e8edf1 30%, #eef2f5 100%)",
          boxShadow:
            "0 -1px 0 rgba(255,255,255,.9), 0 -14px 28px -18px rgba(40,60,80,.35)",
        }}
      />
      <div
        className="absolute"
        style={{
          left: "-10%",
          top: "-12%",
          width: "70%",
          height: "60%",
          background:
            "radial-gradient(closest-side, rgba(255,255,255,.55), rgba(255,255,255,0))",
        }}
      />
    </div>
  );
}

/** true なら今の効果音を鳴らさない。試作が自分の音を鳴らすときに true にする。 */
export const muteDefaultSounds = true;

import { flatSceneColorClassName } from "@/games/water-sort/ui/art/flat/flat-scene-colors";
import { cn } from "@/lib/utils";

/** 木立の樹冠（窓の幅に対する左端と直径、木立の帯の上の縁からの沈み＝直径に対する割合）。 */
const TREE_CROWNS = [
  { left: -4, size: 16, sink: 55 },
  { left: 9, size: 11, sink: 45 },
  { left: 17, size: 18, sink: 60 },
  { left: 32, size: 10, sink: 40 },
  { left: 40, size: 14, sink: 55 },
  { left: 52, size: 12, sink: 48 },
  { left: 62, size: 19, sink: 62 },
  { left: 79, size: 11, sink: 42 },
  { left: 88, size: 16, sink: 56 },
] as const;

/**
 * 真横から見た化学室の壁と窓。窓は枠・空・校庭の木立・窓台の平らな面だけで描く。
 * 実験台と流しの戸棚は、試験管立ての位置に合わせて盤面が描き、戸棚は壁と同じ色なので上端と下端が同じ地の色になる。
 */
export function FlatGround() {
  return (
    <div
      className={cn(
        "relative size-full overflow-hidden bg-(--flat-wall)",
        flatSceneColorClassName,
      )}
    >
      <div className="absolute inset-x-[5%] top-0 h-[31%] sm:inset-x-[12%]">
        <div className="absolute inset-x-0 top-0 bottom-[10px] bg-(--flat-frame)" />
        <div className="absolute inset-x-[10px] top-0 bottom-[20px] overflow-hidden bg-(--flat-sky)">
          {/* 校庭の木立。大きさの違う丸を重ね、上の縁が波打つ1つの面にする。 */}
          <div className="absolute inset-x-0 bottom-0 h-[18%] bg-(--flat-tree)" />
          {TREE_CROWNS.map(({ left, size, sink }) => (
            <div
              key={left}
              className="absolute bottom-[18%] aspect-square rounded-full bg-(--flat-tree)"
              style={{
                left: `${left}%`,
                width: `${size}%`,
                transform: `translateY(${sink}%)`,
              }}
            />
          ))}
          {/* 窓枠の桟 */}
          <div className="absolute inset-y-0 left-1/2 w-[8px] -translate-x-1/2 bg-(--flat-frame)" />
          <div className="absolute inset-x-0 top-[40%] h-[6px] bg-(--flat-frame)" />
        </div>
        {/* 窓台 */}
        <div className="absolute inset-x-[-8px] bottom-0 h-[12px] rounded-[2px] bg-(--flat-frame)" />
      </div>
    </div>
  );
}

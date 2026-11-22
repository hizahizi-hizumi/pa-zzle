import { useId, useLayoutEffect, useRef, useState } from "react";
import { ShelfGlow } from "@/games/water-sort/ui/ideas/alchemy/AlchemyShelves/ShelfGlow";
import { getElixir } from "@/games/water-sort/ui/ideas/alchemy/alchemy-elixirs";
import { isSealedBottle } from "@/games/water-sort/ui/ideas/alchemy/sealed-bottle";
import type { BoardBackdropProps } from "@/games/water-sort/ui/ideas/overrides";

type FlaskFootprint = { centerX: number; width: number; bottom: number };
type Shelf = { left: number; right: number; top: number };

const SHELF_OVERHANG_PX = 14;
const SHELF_SURFACE_PX = 6;
const SHELF_FACE_PX = 9;
/** フラスコの底は枠の下端から 3.5% 上にある（`flask-shapes.ts` の胴の下端）。 */
const FLASK_BASE_RATIO = 0.035;

function measureFootprints(elements: readonly HTMLElement[]): FlaskFootprint[] {
  // 選んだボトルは持ち上げて動かすが、offset は持ち上げの translate を含まないので、置かれた位置が分かる。
  return elements.map((element) => ({
    centerX: element.offsetLeft + element.offsetWidth / 2,
    width: element.offsetWidth,
    bottom: element.offsetTop + element.offsetHeight * (1 - FLASK_BASE_RATIO),
  }));
}

function groupShelves(footprints: readonly FlaskFootprint[]): Shelf[] {
  const shelves: Shelf[] = [];
  for (const footprint of footprints) {
    const left = footprint.centerX - footprint.width / 2 - SHELF_OVERHANG_PX;
    const right = footprint.centerX + footprint.width / 2 + SHELF_OVERHANG_PX;
    const shelf = shelves.find(
      (candidate) => Math.abs(candidate.top - footprint.bottom) < 4,
    );
    if (shelf) {
      shelf.left = Math.min(shelf.left, left);
      shelf.right = Math.max(shelf.right, right);
    } else {
      shelves.push({ left, right, top: footprint.bottom });
    }
  }
  return shelves;
}

/** 壁に渡した木の棚。フラスコはこの上に並び、灯ったフラスコは棚にその色の光を落とす。 */
export function AlchemyShelves({
  state,
  getBottleElements,
}: BoardBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [footprints, setFootprints] = useState<FlaskFootprint[]>([]);
  const id = useId();
  const grainId = `${id}-grain`;
  const faceId = `${id}-face`;
  const bottleCount = state.length;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    function measure() {
      setFootprints(
        measureFootprints(getBottleElements().slice(0, bottleCount)),
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [getBottleElements, bottleCount]);

  const shelves = groupShelves(footprints);

  return (
    <div ref={rootRef} className="absolute inset-0">
      <svg
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.012 0.42"
              numOctaves="2"
              seed="21"
            />
            <feColorMatrix values="0 0 0 0 0.06  0 0 0 0 0.03  0 0 0 0 0.01  0 0 0 -2.2 1.2" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <linearGradient id={faceId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5a3a20" />
            <stop offset="1" stopColor="#2c1b0e" />
          </linearGradient>
        </defs>
        {shelves.map((shelf) => {
          const width = shelf.right - shelf.left;
          const surfaceTop = shelf.top - SHELF_SURFACE_PX + 2;
          const faceTop = shelf.top + 2;
          return (
            <g key={shelf.top}>
              {/* 棚の下に落ちる影 */}
              <rect
                x={shelf.left + 6}
                y={faceTop + SHELF_FACE_PX}
                width={width - 12}
                height="16"
                fill="#000"
                opacity="0.32"
                style={{ filter: "blur(5px)" }}
              />
              {/* 鉄の腕木 */}
              {[shelf.left + 10, shelf.right - 14].map((x) => (
                <path
                  key={x}
                  d={`M ${x} ${faceTop + SHELF_FACE_PX} h 4 v 3 l -4 12 Z`}
                  fill="#1b1410"
                  stroke="#4a3a2c"
                  strokeWidth="0.6"
                />
              ))}
              <rect
                x={shelf.left}
                y={surfaceTop}
                width={width}
                height={SHELF_SURFACE_PX}
                fill="#6b4728"
              />
              <rect
                x={shelf.left}
                y={faceTop}
                width={width}
                height={SHELF_FACE_PX}
                rx="1"
                fill={`url(#${faceId})`}
              />
              <rect
                x={shelf.left}
                y={surfaceTop}
                width={width}
                height={SHELF_SURFACE_PX + SHELF_FACE_PX}
                fill="#000"
                filter={`url(#${grainId})`}
                opacity="0.5"
              />
              <rect
                x={shelf.left}
                y={faceTop}
                width={width}
                height="0.8"
                fill="#ffcf94"
                opacity="0.35"
              />
            </g>
          );
        })}
        {footprints.map((footprint, index) => {
          const contents = state[index];
          const sealedColor =
            contents && isSealedBottle(contents)
              ? getElixir(contents[0] ?? 0).color
              : null;
          return (
            // 大きさが変わって測り直しても灯り直さないよう、ボトルの番号で区別する。
            // biome-ignore lint/suspicious/noArrayIndexKey: 並びはボトルの番号そのもの
            <g key={index}>
              {sealedColor && (
                <ShelfGlow
                  centerX={footprint.centerX}
                  bottom={footprint.bottom}
                  flaskWidth={footprint.width}
                  color={sealedColor}
                />
              )}
              <ellipse
                cx={footprint.centerX}
                cy={footprint.bottom}
                rx={footprint.width * 0.44}
                ry="2.2"
                fill="#000"
                opacity="0.55"
                style={{ filter: "blur(1.2px)" }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

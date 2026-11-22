import { useLayoutEffect, useRef, useState } from "react";

import type { BoardBackdropProps } from "@/games/water-sort/ui/ideas/overrides";

type JarSpot = { centerX: number; width: number; height: number };
type ShelfRow = { restY: number; jars: JarSpot[] };

/** 瓶の底が棚板の上面に少し沈んで見える深さ（px）。 */
const SHELF_TOP_DEPTH = 6;
const SHELF_FRONT_HEIGHT = 10;

/** 瓶を並べる壁の棚板。段ごとに、瓶の底の高さへ板を渡す。 */
export function KitchenShelves({
  state,
  getBottleElements,
}: BoardBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<readonly ShelfRow[]>([]);
  const bottleCount = state.length;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || bottleCount === 0) {
      return;
    }
    function measure() {
      if (!container) {
        return;
      }
      setRows(measureShelfRows(container, getBottleElements()));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const firstBottle = getBottleElements()[0];
    if (firstBottle) {
      observer.observe(firstBottle);
    }
    return () => observer.disconnect();
  }, [getBottleElements, bottleCount]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {rows.map((row) => (
        <div
          key={row.restY}
          className="absolute inset-x-0"
          style={{ top: row.restY - SHELF_TOP_DEPTH }}
        >
          <div className="relative h-[6px] bg-[linear-gradient(180deg,#d9bf94_0%,#ead5b0_100%)] dark:bg-[linear-gradient(180deg,#3f2c1d_0%,#5f442d_100%)]" />
          <div
            className="relative bg-[linear-gradient(180deg,#c49d68_0%,#b08655_100%)] shadow-[0_6px_10px_-2px_rgba(90,60,30,0.28)] dark:bg-[linear-gradient(180deg,#4d3522_0%,#38261a_100%)] dark:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.55)]"
            style={{ height: SHELF_FRONT_HEIGHT }}
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(178.6deg,rgba(255,240,210,0)_0px,rgba(255,240,210,0)_3px,rgba(255,240,210,0.16)_3.5px,rgba(255,240,210,0)_4.5px)] dark:opacity-40" />
            <div className="absolute inset-x-0 top-0 h-px bg-[#f3e2c2]/70 dark:bg-[#8a6a4a]/40" />
          </div>
          {/* 瓶が板に触れる所の影。 */}
          {row.jars.map((jar) => (
            <span
              key={jar.centerX}
              className="absolute top-[1px] h-[6px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(80,50,20,0.38)_0%,rgba(80,50,20,0)_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0)_70%)]"
              style={{ left: jar.centerX, width: jar.width * 1.05 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function measureShelfRows(
  container: HTMLElement,
  bottles: readonly HTMLElement[],
): ShelfRow[] {
  const base = container.getBoundingClientRect();
  const rows = new Map<number, ShelfRow>();
  for (const bottle of bottles) {
    const rect = bottle.getBoundingClientRect();
    // 持ち上げている瓶も、置いてある高さで測る。
    const liftY =
      Number.parseFloat(
        getComputedStyle(bottle).translate.split(" ")[1] ?? "0",
      ) || 0;
    const restY = Math.round(rect.bottom - liftY - base.top);
    const row = rows.get(restY) ?? { restY, jars: [] };
    row.jars.push({
      centerX: rect.left + rect.width / 2 - base.left,
      width: rect.width,
      height: rect.height,
    });
    rows.set(restY, row);
  }
  return [...rows.values()];
}

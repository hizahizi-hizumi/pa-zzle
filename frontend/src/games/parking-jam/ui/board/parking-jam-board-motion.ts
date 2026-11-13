import type { ParkingJamDirection } from "@/games/parking-jam/puzzle/board";

type Translation = { x: number; y: number };

/** 出られない車が、ぶつかって元の位置へ戻り終えるまでの長さ。 */
const PARKING_JAM_COLLISION_DURATION_MS = 280;
/** 出られない車が、ぶつかる相手に当たる時刻。 */
export const PARKING_JAM_COLLISION_IMPACT_MS = Math.round(
  PARKING_JAM_COLLISION_DURATION_MS * 0.42,
);
/** 当たった相手が揺れる長さ。 */
const STRUCK_SHAKE_DURATION_MS = 220;
/** 当たった相手が、押された向きへ揺れる量。 */
const STRUCK_SHAKE_DISTANCE = 16;
/** ぶつかった車が跳ね返る量。 */
const COLLISION_REBOUND_DISTANCE = 18;
/** ぶつかる相手へ加速していく、当たった後に跳ね返る、元の位置へ戻る動きのイージング。 */
const COLLISION_APPROACH_EASING = "cubic-bezier(0.55, 0, 1, 0.6)";
const COLLISION_REBOUND_EASING = "cubic-bezier(0, 0, 0.3, 1)";
const COLLISION_RETURN_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const STRUCK_SHAKE_EASING = "ease-out";

/** 行き止まりの縁石が、車が当たった瞬間から光って消えるまでの長さとイージング。 */
export const PARKING_JAM_ROADLESS_CURB_FLASH_MS = 420;
export const PARKING_JAM_ROADLESS_CURB_FLASH_EASING = "ease-out";

/** 出ていく動きの長さ。 */
export const PARKING_JAM_EXIT_DURATION_MS = 520;
const EXIT_EASING = "cubic-bezier(0.25, 0.1, 0.45, 1)";

/** 最後の車が駐車場を抜けかけたところで、空いた駐車場の線を光らせ始める。 */
export const PARKING_JAM_FINALE_DELAY_MS = 240;
/** 線が1本ずつ光って戻るまでの長さ。 */
const FINALE_LINE_DURATION_MS = 300;
/** 最後の車が出た所から遠い線ほど遅れて光り始める、その遅れの最大。 */
const FINALE_SPREAD_MS = 260;
const FINALE_LINE_EASING = "ease-out";

function translate({ x, y }: Translation): string {
  return `translate(${x}px, ${y}px)`;
}

function scale(translation: Translation, factor: number): Translation {
  return { x: translation.x * factor, y: translation.y * factor };
}

function getUnitVector(direction: ParkingJamDirection): Translation {
  switch (direction) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
  }
}

/** 途中の動きから次の動きへ移るときに、今見えている位置から始める。 */
function getCurrentTransform(element: Element): string {
  const transform = getComputedStyle(element).transform;
  return transform && transform !== "none"
    ? transform
    : translate({ x: 0, y: 0 });
}

function stopAnimations(element: Element): string {
  const from = getCurrentTransform(element);
  for (const animation of element.getAnimations()) {
    animation.cancel();
  }
  return from;
}

function canAnimate(element: Element | null | undefined): element is Element {
  return (
    typeof element?.animate === "function" &&
    typeof element.getAnimations === "function"
  );
}

/** 車を、ぶつかる相手まで加速して走らせ、当たって跳ね返り、元の位置へ戻す。 */
export function playParkingJamCollision(
  car: Element | null | undefined,
  direction: ParkingJamDirection,
  hit: Translation,
): void {
  if (!canAnimate(car)) {
    return;
  }
  const from = stopAnimations(car);
  const rebound = scale(getUnitVector(direction), -COLLISION_REBOUND_DISTANCE);
  const impactOffset =
    PARKING_JAM_COLLISION_IMPACT_MS / PARKING_JAM_COLLISION_DURATION_MS;
  car.animate(
    [
      { transform: from, easing: COLLISION_APPROACH_EASING },
      {
        transform: translate(hit),
        offset: impactOffset,
        easing: COLLISION_REBOUND_EASING,
      },
      {
        transform: translate({ x: hit.x + rebound.x, y: hit.y + rebound.y }),
        offset: impactOffset + 0.18,
        easing: COLLISION_RETURN_EASING,
      },
      { transform: translate({ x: 0, y: 0 }) },
    ],
    { duration: PARKING_JAM_COLLISION_DURATION_MS },
  );
}

/** ぶつけられた車か植え込みを、押された向きへ一瞬揺らす。走っている動きに重ねる。 */
export function playParkingJamStruck(
  target: Element | null | undefined,
  direction: ParkingJamDirection,
): void {
  if (!canAnimate(target)) {
    return;
  }
  const push = scale(getUnitVector(direction), STRUCK_SHAKE_DISTANCE);
  target.animate(
    [
      { transform: translate({ x: 0, y: 0 }) },
      { transform: translate(push), offset: 0.2 },
      { transform: translate(scale(push, -0.45)), offset: 0.5 },
      { transform: translate(scale(push, 0.2)), offset: 0.75 },
      { transform: translate({ x: 0, y: 0 }) },
    ],
    {
      duration: STRUCK_SHAKE_DURATION_MS,
      delay: PARKING_JAM_COLLISION_IMPACT_MS,
      easing: STRUCK_SHAKE_EASING,
      composite: "add",
    },
  );
}

/** 出ていった後も盤面の外に留め、戻されるまで見せない。 */
export function playParkingJamExit(
  car: Element | null | undefined,
  exit: Translation,
): void {
  if (!canAnimate(car)) {
    return;
  }
  const from = stopAnimations(car);
  car.animate([{ transform: from }, { transform: translate(exit) }], {
    duration: PARKING_JAM_EXIT_DURATION_MS,
    easing: EXIT_EASING,
    fill: "forwards",
  });
}

/** 盤面に戻された車を、元の位置に置き直す。 */
export function resetParkingJamCar(car: Element | null | undefined): void {
  if (!canAnimate(car)) {
    return;
  }
  for (const animation of car.getAnimations()) {
    animation.cancel();
  }
}

type FinaleLine = {
  element: Element;
  /** 最後の車が出た所からの距離。 */
  distance: number;
};

/** 空いた駐車場の線を、最後の車が出た所から順に光らせる。 */
export function playParkingJamFinale(
  lines: readonly FinaleLine[],
): Animation[] {
  const farthest = Math.max(1, ...lines.map(({ distance }) => distance));
  return lines.flatMap(({ element, distance }) =>
    canAnimate(element)
      ? [
          element.animate(
            [
              {},
              {
                stroke: "#fff3b8",
                strokeWidth: "8",
                filter: "drop-shadow(0 0 6px rgb(255 226 120 / 0.95))",
                offset: 0.3,
              },
              {},
            ],
            {
              duration: FINALE_LINE_DURATION_MS,
              delay:
                PARKING_JAM_FINALE_DELAY_MS +
                (distance / farthest) * FINALE_SPREAD_MS,
              easing: FINALE_LINE_EASING,
            },
          ),
        ]
      : [],
  );
}

/** 酒棚の段（地の SVG の座標、幅 1200・高さ 900）。 */
export const BACK_BAR_SHELF_YS = [190, 360, 530] as const;

const bottleTints = [
  "amber",
  "green",
  "clear",
  "ruby",
  "amber",
  "smoke",
] as const;

export type BackBarBottleTint = (typeof bottleTints)[number];

export type BackBarBottle = {
  path: string;
  tint: BackBarBottleTint;
};

type BottleShape = {
  bodyRatio: number;
  neckRatio: number;
  shoulder: number;
};

const bottleShapes: readonly BottleShape[] = [
  // 肩のなで下がった細長い瓶
  { bodyRatio: 0.58, neckRatio: 0.26, shoulder: 0.22 },
  // 角ばった肩の瓶
  { bodyRatio: 0.72, neckRatio: 0.3, shoulder: 0.06 },
  // ずんぐりした瓶
  { bodyRatio: 0.66, neckRatio: 0.34, shoulder: 0.14 },
  // 首の長い瓶
  { bodyRatio: 0.5, neckRatio: 0.22, shoulder: 0.18 },
];

/** 同じ並びを毎回描くための、決まった順に値を返す擬似乱数。 */
function createSequence(seed: number) {
  let value = seed;
  return function next() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function createBottlePath(
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  shape: BottleShape,
): string {
  const half = width / 2;
  const neckHalf = (width * shape.neckRatio) / 2;
  const shoulderTop = baseY - height * shape.bodyRatio;
  const neckBottom = shoulderTop - height * shape.shoulder;
  const top = baseY - height;
  const lipHalf = neckHalf * 1.25;
  return [
    `M ${centerX - half} ${baseY}`,
    `L ${centerX - half} ${shoulderTop}`,
    `Q ${centerX - half} ${neckBottom} ${centerX - neckHalf} ${neckBottom}`,
    `L ${centerX - neckHalf} ${top + 10}`,
    `L ${centerX - lipHalf} ${top + 8}`,
    `L ${centerX - lipHalf} ${top}`,
    `L ${centerX + lipHalf} ${top}`,
    `L ${centerX + lipHalf} ${top + 8}`,
    `L ${centerX + neckHalf} ${top + 10}`,
    `L ${centerX + neckHalf} ${neckBottom}`,
    `Q ${centerX + half} ${neckBottom} ${centerX + half} ${shoulderTop}`,
    `L ${centerX + half} ${baseY}`,
    "Z",
  ].join(" ");
}

/** 逆光で影絵のように並ぶ瓶。銘柄やラベルは描かない。 */
export const BACK_BAR_BOTTLES: readonly BackBarBottle[] =
  BACK_BAR_SHELF_YS.flatMap((shelfY, shelfIndex) => {
    const next = createSequence(17 + shelfIndex * 31);
    const bottles: BackBarBottle[] = [];
    let x = 10 + next() * 40;
    while (x < 1190) {
      const width = 34 + next() * 26;
      const height = 104 + next() * 46;
      const shape =
        bottleShapes[Math.floor(next() * bottleShapes.length)] ??
        bottleShapes[0];
      const tint =
        bottleTints[Math.floor(next() * bottleTints.length)] ?? "amber";
      if (shape) {
        bottles.push({
          path: createBottlePath(
            x + width / 2,
            shelfY - 3,
            width,
            height,
            shape,
          ),
          tint,
        });
      }
      x += width + 8 + next() * 22;
    }
    return bottles;
  });

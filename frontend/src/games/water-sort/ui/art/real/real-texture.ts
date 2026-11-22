/**
 * 壁・木・天板・ゴムに共通の、表面のざらつき。どの材質も同じ細かさ（画面の px で決めた周期）と同じ明るさの振れにし、
 * 1つだけ写真のように細かい・1つだけ平ら、を作らない。木は同じノイズを横にだけ引き伸ばして木目にする。
 * 画面の px で決めるので、小さい試験管でも粒は大きくならず、面が小さくなるだけになる。
 *
 * どれも、明るさの中心が 50% の灰色のノイズ画像。上に重ねて `overlay` で混ぜると、下の色の明るさを上下に振る。
 */

/** ざらつきの細かさ（1px あたりの周波数）。 */
const GRAIN_FREQUENCY = 0.55;
/** 木目の、木の繊維に沿う向きの細かさ。 */
const WOOD_FIBER_FREQUENCY = 0.018;
const TILE_SIZE = 192;

function noiseSvg(baseFrequency: string, contrast: number, seed: number) {
  const offset = 0.5 - 0.5 * contrast;
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_SIZE}' height='${TILE_SIZE}'>` +
    `<filter id='n' x='0' y='0' width='1' height='1' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${baseFrequency}' numOctaves='3' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='${contrast} 0 0 0 ${offset}  ${contrast} 0 0 0 ${offset}  ${contrast} 0 0 0 ${offset}  0 0 0 0 1'/>` +
    `</filter><rect width='${TILE_SIZE}' height='${TILE_SIZE}' filter='url(#n)'/></svg>`
  );
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** 塗り壁・耐薬品の天板・ゴム。向きの無い細かなざらつき。 */
export const SURFACE_GRAIN_URI = toDataUri(
  noiseSvg(`${GRAIN_FREQUENCY}`, 0.8, 9),
);

/** 木。ざらつきと同じ縦の細かさで、横にだけ長い。 */
export const WOOD_GRAIN_URI = toDataUri(
  noiseSvg(`${WOOD_FIBER_FREQUENCY} ${GRAIN_FREQUENCY}`, 1.1, 3),
);

export const NOISE_TILE_SIZE = TILE_SIZE;

export function cssImage(uri: string): string {
  return `url("${uri}")`;
}

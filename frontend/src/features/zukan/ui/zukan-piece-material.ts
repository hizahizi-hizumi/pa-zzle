import type { GameResultLevel } from "@/games/result";

/**
 * ジグソーのピースの質感。上質な塗りを施した、木製の手挽きのピース。
 * 平面（ゲームのホームの台紙・運ぶピースの SVG）も立体（結果のピースの WebGL）も、この値から描く。
 * 長さはどれもピースの1辺に対する比、割合は 0〜1。
 */
export const ZUKAN_PIECE_MATERIAL = {
  /** 光の来る向き。画面の右を x、下を y、手前を z とする単位ベクトル。全画面で同じ、左上の高い窓から。 */
  lightDirection: { x: -0.42, y: -0.66, z: 0.62 },
  /** 面の広く淡い階調。光の側の端で白を、反対の端で黒を重ねる割合。 */
  faceLight: 0.06,
  faceShade: 0.04,
  /** 縁の細く鋭い面取り。光の側に明るい稜線、反対側に細い陰を引く幅と、重ねる白・黒の割合。 */
  bevelWidth: 0.024,
  bevelLight: 0.22,
  bevelShade: 0.13,
  /** 台紙に嵌まったピースの、光の側の溝に、台紙の窪みの縁が落とす陰の濃さ。 */
  contactShadow: 0.13,
  /** 板の厚み。 */
  thickness: 0.1,
  /** 木口（側面）と裏の色。面の色をこの割合だけ深くする。 */
  sideDepth: 0.3,
  backDepth: 0.1,
  /** 立体の面の照り返し。斜めから見たときに部屋の白い壁を映す割合と、窓の柔らかい照り。 */
  sheen: 0.1,
  windowGlow: 0.3,
  /** 浮かせたときの、淡く広い落ち影の濃さ。 */
  dropShadowOpacity: 0.1,
} as const;

type Point = { x: number; y: number };

function lightOnScreen(): Point {
  const { x, y } = ZUKAN_PIECE_MATERIAL.lightDirection;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

/**
 * 面の階調を引く線。マスの左上を原点、1辺を 1 とする座標で、光の側の端から反対の端まで。
 * 面の上の位置の、この線の上での割合が階調の位置になる。
 */
export function getZukanPieceLightAxis(): { from: Point; to: Point } {
  const light = lightOnScreen();
  // 1辺 1 の正方形の角まで届く長さ。
  const reach = (Math.abs(light.x) + Math.abs(light.y)) / 2;
  return {
    from: { x: 0.5 + light.x * reach, y: 0.5 + light.y * reach },
    to: { x: 0.5 - light.x * reach, y: 0.5 - light.y * reach },
  };
}

/** 面の階調の色の止まり。光の側で白、中ほどで素の色、反対の側で黒を重ねる。 */
export const ZUKAN_PIECE_LIGHT_STOPS = [
  { offset: 0, color: "#fff", opacity: ZUKAN_PIECE_MATERIAL.faceLight },
  { offset: 0.5, color: "#fff", opacity: 0 },
  { offset: 0.5, color: "#000", opacity: 0 },
  { offset: 1, color: "#000", opacity: ZUKAN_PIECE_MATERIAL.faceShade },
] as const;

const PATH_POINT = /(-?\d*\.?\d+),(-?\d*\.?\d+)/g;

function translatePath(path: string, dx: number, dy: number): string {
  return path.replace(
    PATH_POINT,
    (_, x: string, y: string) =>
      `${Number((Number(x) + dx).toFixed(4))},${Number((Number(y) + dy).toFixed(4))}`,
  );
}

/**
 * 縁の稜線と陰の帯。輪郭と、ずらした輪郭を重ね、奇偶の規則で塗って、輪郭の中に収めると、
 * ずらした向きと反対を向く辺にだけ帯が残る。辺の向きに応じて帯の幅が変わるので、曲がったタブの縁も光の向きに沿う。
 */
function bevelBand(path: string, sign: 1 | -1) {
  const light = lightOnScreen();
  const lead = Math.max(Math.abs(light.x), Math.abs(light.y));
  const { bevelWidth } = ZUKAN_PIECE_MATERIAL;
  const dx = (sign * bevelWidth * -light.x) / lead;
  const dy = (sign * bevelWidth * -light.y) / lead;
  return `${path} ${translatePath(path, dx, dy)}`;
}

/**
 * 台紙から出した平面のピースを描く層。下から順に重ね、どれもピースの輪郭で切り抜いて描く。
 * - `face`: 評価の色の面（`currentColor`）
 * - `light`: 面の広く淡い階調（`ZUKAN_PIECE_LIGHT_STOPS` の線形グラデーション）
 * - `bevel-light`: 光の側の縁の明るい稜線
 * - `bevel-shade`: 反対側の縁の細い陰
 */
export type ZukanPieceLayer =
  | { kind: "face"; d: string }
  | { kind: "light"; d: string }
  | { kind: "bevel-light"; d: string; opacity: number }
  | { kind: "bevel-shade"; d: string; opacity: number };

export function listZukanPieceLayers(path: string): ZukanPieceLayer[] {
  const { bevelLight, bevelShade } = ZUKAN_PIECE_MATERIAL;
  return [
    { kind: "face", d: path },
    { kind: "light", d: path },
    { kind: "bevel-light", d: bevelBand(path, 1), opacity: bevelLight },
    { kind: "bevel-shade", d: bevelBand(path, -1), opacity: bevelShade },
  ];
}

export type ZukanPieceGradientStop = { offset: number; color: string };

function mixColor(color: string, other: string, ratio: number): string {
  return `color-mix(in srgb, ${color}, ${other} ${Number((ratio * 100).toFixed(2))}%)`;
}

/**
 * 台紙に嵌まったピースの面の色の止まり。評価の色 `color` に、面の広く淡い階調を混ぜておく。
 * 面と階調を重ねて塗るとピースごとの塗りが2つになるので、混ぜた1つの塗りで描く。
 */
export function listZukanSheetPieceFaceStops(
  color: string,
): ZukanPieceGradientStop[] {
  const { faceLight, faceShade } = ZUKAN_PIECE_MATERIAL;
  return [
    { offset: 0, color: mixColor(color, "#fff", faceLight) },
    { offset: 0.5, color },
    { offset: 1, color: mixColor(color, "#000", faceShade) },
  ];
}

/**
 * 台紙に嵌まったピースの溝の線の色の止まり。溝の色 `grooveColor` に、光の側で、台紙の窪みの縁が落とす陰を混ぜる。
 * 溝は隣り合う2つのピースの線が重なってできる。台紙は後に並ぶ右下のピースの線を手前に重ねるので、各ピースの線の光の側（左上）が溝の色を決める。
 */
export function listZukanSheetPieceGrooveStops(
  grooveColor: string,
): ZukanPieceGradientStop[] {
  return [
    {
      offset: 0.2,
      color: mixColor(grooveColor, "#000", ZUKAN_PIECE_MATERIAL.contactShadow),
    },
    { offset: 0.5, color: grooveColor },
  ];
}

/** 台紙に嵌まったピースの面の階調の ID。 */
export function getZukanSheetPieceFaceId(level: GameResultLevel): string {
  return `zukan-sheet-piece-face-${level}`;
}

/** 台紙に嵌まったピースの溝の線の階調の ID。 */
export const ZUKAN_SHEET_PIECE_GROOVE_ID = "zukan-sheet-piece-groove";

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

/** SVG の `<linearGradient>` の文字列。階調の線は、ピースの座標で引く。 */
function drawZukanPieceLightGradient(id: string): string {
  const { from, to } = getZukanPieceLightAxis();
  const stops = ZUKAN_PIECE_LIGHT_STOPS.map(
    ({ offset, color, opacity }) =>
      `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`,
  ).join("");
  return `<linearGradient id="${escapeAttribute(id)}" gradientUnits="userSpaceOnUse" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}">${stops}</linearGradient>`;
}

/**
 * 台紙から出した1つのピースを描く SVG の中身の文字列。`face` は面の色。
 * 切り抜きと階調の ID は `idPrefix` から作る。
 */
export function drawZukanPieceSvgContent({
  path,
  idPrefix,
  face,
}: {
  path: string;
  idPrefix: string;
  face: string;
}): string {
  const clipId = `${idPrefix}-clip`;
  const lightId = `${idPrefix}-light`;
  const layers = listZukanPieceLayers(path)
    .map((layer) => drawLayer(layer, { face, light: lightId }))
    .join("");
  return `<defs>${drawZukanPieceLightGradient(lightId)}<clipPath id="${escapeAttribute(clipId)}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${escapeAttribute(clipId)})">${layers}</g>`;
}

/** 層の1つを、SVG の `<path>` の文字列にする。 */
function drawLayer(
  layer: ZukanPieceLayer,
  paints: { face: string; light: string },
): string {
  switch (layer.kind) {
    case "face":
      return `<path d="${layer.d}" fill="${paints.face}"/>`;
    case "light":
      return `<path d="${layer.d}" fill="url(#${escapeAttribute(paints.light)})"/>`;
    case "bevel-light":
      return `<path d="${layer.d}" fill="#fff" fill-opacity="${layer.opacity}" fill-rule="evenodd"/>`;
    case "bevel-shade":
      return `<path d="${layer.d}" fill="#000" fill-opacity="${layer.opacity}" fill-rule="evenodd"/>`;
  }
}

export const _private = { translatePath };

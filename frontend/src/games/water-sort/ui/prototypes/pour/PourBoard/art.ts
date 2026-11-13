// 素材（木の立て・ガラス・コルク）を SVG で描き、画像にして使い回す。光は画面全体で左上から。

export type LiquidColor = { light: string; deep: string; surface: string };

const liquidColorPairs: readonly (readonly [string, string])[] = [
  ["#ee4b4b", "#b8262f"], // 赤
  ["#3d7cf0", "#2049b8"], // 青
  ["#3fbf6a", "#1f8f48"], // 緑
  ["#ffd23f", "#e0a412"], // 黄
  ["#a35ee8", "#6d2fbd"], // 紫
  ["#ff9a3c", "#d9661a"], // 橙
  ["#6fd6f2", "#2296c2"], // 水色
  ["#f77bbb", "#c93a86"], // 桃
  ["#bde04a", "#7ea41c"], // 黄緑
  ["#cdb4ff", "#8e70dc"], // 薄紫
  ["#d3d9e2", "#8f9aaa"], // 薄い灰
  ["#33b9ab", "#127a74"], // 青緑
];

export function mix(hex: string, toward: string, k: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const ch = (n: number, shift: number) => (n >> shift) & 255;
  const r = Math.round(ch(a, 16) + (ch(b, 16) - ch(a, 16)) * k);
  const g = Math.round(ch(a, 8) + (ch(b, 8) - ch(a, 8)) * k);
  const bl = Math.round(ch(a, 0) + (ch(b, 0) - ch(a, 0)) * k);
  return `rgb(${r},${g},${bl})`;
}

const colorCache = new Map<number, LiquidColor>();
export function liquidColor(colorIndex: number): LiquidColor {
  const cached = colorCache.get(colorIndex);
  if (cached) return cached;
  const pair = liquidColorPairs[colorIndex] ?? ["#999999", "#555555"];
  const color = {
    light: pair[0],
    deep: pair[1],
    surface: mix(pair[0], "#ffffff", 0.42),
  };
  colorCache.set(colorIndex, color);
  return color;
}

export const CAV_D = "M-22,4 L-22,172 A22,22 0 0 0 22,172 L22,4 Z";
const OUT_D = "M-26,5 L-26,172 A26,26 0 0 0 26,172 L26,5";

/** 試験管の画像の範囲（局所座標）。 */
export const TUBE_IMAGE_BOX = { x: -34, y: -26, w: 68, h: 232 } as const;

function svgDocument(
  viewBox: { x: number; y: number; w: number; h: number },
  pixelScale: number,
  body: string,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(viewBox.w * pixelScale)}" height="${Math.ceil(viewBox.h * pixelScale)}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}">${body}</svg>`;
}

export function glassSvg(pixelScale: number): string {
  return svgDocument(
    TUBE_IMAGE_BOX,
    pixelScale,
    `<defs>
<clipPath id="cav"><path d="${CAV_D}"/></clipPath>
<linearGradient id="cyl" x1="-22" x2="22" y1="0" y2="0" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#000" stop-opacity=".12"/>
  <stop offset=".08" stop-color="#fff" stop-opacity=".28"/>
  <stop offset=".22" stop-color="#fff" stop-opacity=".08"/>
  <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
  <stop offset=".75" stop-color="#000" stop-opacity=".08"/>
  <stop offset="1" stop-color="#000" stop-opacity=".26"/>
</linearGradient>
<linearGradient id="glassBody" x1="-26" x2="26" y1="0" y2="0" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".32"/>
  <stop offset=".22" stop-color="#ffffff" stop-opacity=".06"/>
  <stop offset=".7" stop-color="#dfe9f2" stop-opacity=".03"/>
  <stop offset="1" stop-color="#b9cadb" stop-opacity=".32"/>
</linearGradient>
<linearGradient id="hlStrip" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity="0"/>
  <stop offset=".08" stop-color="#fff" stop-opacity=".88"/>
  <stop offset=".7" stop-color="#fff" stop-opacity=".55"/>
  <stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<filter id="b06" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="0.6"/></filter>
</defs>
<rect x="-22" y="0" width="44" height="200" fill="url(#cyl)" clip-path="url(#cav)"/>
<path d="${OUT_D}" fill="url(#glassBody)" stroke="rgba(78,98,120,.45)" stroke-width="1"/>
<path d="${CAV_D}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".8"/>
<path d="M22.6,12 L22.6,172 A22.6,22.6 0 0 1 12,191" stroke="rgba(60,80,100,.18)" stroke-width="1.6" fill="none"/>
<rect x="-19.5" y="14" width="4.6" height="160" rx="2.3" fill="url(#hlStrip)" filter="url(#b06)"/>
<path d="M-24.3,10 L-24.3,172 A24.3,24.3 0 0 0 -14,193" stroke="#fff" stroke-width=".9" fill="none" opacity=".78"/>
<rect x="15.5" y="20" width="1.6" height="146" rx=".8" fill="#fff" opacity=".3"/>
<path d="M-12,188 A20,20 0 0 0 6,190" stroke="#fff" stroke-width="1.3" fill="none" opacity=".55" filter="url(#b06)"/>
<ellipse cx="0" cy="4" rx="28.5" ry="5.2" fill="rgba(255,255,255,.38)" stroke="rgba(78,98,120,.5)" stroke-width="1"/>
<path d="M-28.5,4 L-28.5,6.5 A28.5,5.2 0 0 0 28.5,6.5 L28.5,4 A28.5,5.2 0 0 1 -28.5,4" fill="rgba(220,232,242,.55)" stroke="rgba(78,98,120,.45)" stroke-width=".8"/>
<ellipse cx="0" cy="4" rx="23.5" ry="3.6" fill="rgba(70,92,115,.16)" stroke="rgba(255,255,255,.7)" stroke-width=".8"/>
<path d="M-25,2.2 A27,4.2 0 0 1 -4,-0.6" stroke="#fff" stroke-width="1.2" fill="none" opacity=".9"/>`,
  );
}

function rimFrontBody(): string {
  return `<path d="M-28.5,4 L-28.5,6.5 A28.5,5.2 0 0 0 28.5,6.5 L28.5,4 A28.5,5.2 0 0 1 -28.5,4" fill="rgba(220,232,242,.3)" stroke="rgba(78,98,120,.45)" stroke-width=".8"/>
<path d="M-25,2.2 A27,4.2 0 0 1 -4,-0.6" stroke="#fff" stroke-width="1.2" fill="none" opacity=".9"/>`;
}

/** 栓をした口の前側の縁。栓の胴の手前に重ねる。 */
export function rimFrontSvg(pixelScale: number): string {
  return svgDocument(TUBE_IMAGE_BOX, pixelScale, rimFrontBody());
}

export function corkSvg(pixelScale: number): string {
  return svgDocument(
    TUBE_IMAGE_BOX,
    pixelScale,
    `<defs>
<radialGradient id="cork" cx=".35" cy=".3" r=".9">
  <stop offset="0" stop-color="#e2b682"/><stop offset=".6" stop-color="#c8955e"/><stop offset="1" stop-color="#a87442"/>
</radialGradient>
<filter id="corkTex" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 2.4 -1.25" result="c"/>
  <feComposite in="c" in2="SourceAlpha" operator="in"/>
</filter>
</defs>
<path d="M-21,-12 L-19.5,14 Q0,17.5 19.5,14 L21,-12 Z" fill="url(#cork)"/>
<path d="M-21,-12 L-19.5,14 Q0,17.5 19.5,14 L21,-12 Z" fill="#000" filter="url(#corkTex)" opacity=".9"/>
<path d="M14,-12 L13.5,14" stroke="#7c5129" stroke-width="4" opacity=".18"/>
<path d="M-15,-10 L-14.5,12" stroke="#f3d2a4" stroke-width="2.4" opacity=".45"/>
<ellipse cx="0" cy="-12" rx="21" ry="3.6" fill="#d9ad78" stroke="#a87442" stroke-width=".8"/>
<ellipse cx="0" cy="-12" rx="21" ry="3.6" fill="#000" filter="url(#corkTex)" opacity=".7"/>
<path d="M-15,-13.5 A16,2.2 0 0 1 8,-14.6" stroke="#f6dcb5" stroke-width="1" fill="none" opacity=".8"/>`,
  );
}

export type RackGeometry = {
  width: number;
  height: number;
  tierTops: readonly number[];
  /** 段ごとの、試験管を立てる穴の中心 x。 */
  holes: readonly (readonly number[])[];
};

const woodDefs = `<linearGradient id="woodTop" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="#e3c391"/><stop offset="1" stop-color="#f1d9ad"/>
</linearGradient>
<linearGradient id="woodFront" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="#d6a669"/><stop offset=".55" stop-color="#c6935a"/><stop offset="1" stop-color="#ad7942"/>
</linearGradient>
<linearGradient id="postL" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#e6c088"/><stop offset=".7" stop-color="#d1a265"/><stop offset="1" stop-color="#b78549"/>
</linearGradient>
<linearGradient id="postR" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#d0a063"/><stop offset=".5" stop-color="#c08d52"/><stop offset="1" stop-color="#a1703a"/>
</linearGradient>
<linearGradient id="dowel" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="#ebcf9e"/><stop offset=".5" stop-color="#cfa16a"/><stop offset="1" stop-color="#a97a45"/>
</linearGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.008 0.42" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.2 -0.85" result="c"/>
  <feComposite in="c" in2="SourceAlpha" operator="in"/>
</filter>
<filter id="grainV" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.42 0.006" numOctaves="3" seed="11" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.2 -0.85" result="c"/>
  <feComposite in="c" in2="SourceAlpha" operator="in"/>
</filter>
<filter id="blur1"><feGaussianBlur stdDeviation="1"/></filter>
<filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>`;

/** 試験管より奥にある部分: 床の影、奥の横木、板の天面と穴、下の板のくぼみ。 */
export function rackBackSvg(rack: RackGeometry, pixelScale: number): string {
  const { width: w, tierTops, holes } = rack;
  const left = 12;
  const boardW = w - 24;
  const lastTop = tierTops[tierTops.length - 1] ?? 0;
  let s = `<defs>${woodDefs}</defs>`;
  s += `<ellipse cx="${w / 2 + 6}" cy="${lastTop + 220}" rx="${w / 2 + 4}" ry="10" fill="#2c3a48" opacity=".24" filter="url(#blur6)"/>`;
  s += `<ellipse cx="${w / 2 + 3}" cy="${lastTop + 218}" rx="${w / 2 - 4}" ry="3" fill="#2c3a48" opacity=".26" filter="url(#blur1)"/>`;
  tierTops.forEach((y, tier) => {
    s += `<rect x="${left}" y="${y + 104}" width="${boardW}" height="7" rx="3.5" fill="url(#dowel)"/>`;
    s += `<rect x="${left}" y="${y + 112}" width="${boardW}" height="3" fill="#7a5a3a" opacity=".1" filter="url(#blur1)"/>`;
    s += `<rect x="${left}" y="${y + 20}" width="${boardW}" height="10" rx="1.5" fill="url(#woodTop)"/>`;
    s += `<rect x="${left}" y="${y + 20}" width="${boardW}" height="10" fill="#000" filter="url(#grain)" opacity=".55"/>`;
    for (const x of holes[tier] ?? []) {
      s += `<ellipse cx="${x}" cy="${y + 25}" rx="29.5" ry="4.2" fill="#7a5229"/>`;
      s += `<ellipse cx="${x}" cy="${y + 25.6}" rx="28" ry="3.4" fill="#4a2d14" opacity=".78"/>`;
      s += `<path d="M${x - 29.5},${y + 25} A29.5,4.2 0 0 0 ${x + 29.5},${y + 25}" stroke="#f4dcae" stroke-width=".8" fill="none" opacity=".8"/>`;
    }
    s += `<rect x="${left}" y="${y + 188}" width="${boardW}" height="14" rx="1.5" fill="url(#woodTop)"/>`;
    s += `<rect x="${left}" y="${y + 188}" width="${boardW}" height="14" fill="#000" filter="url(#grain)" opacity=".55"/>`;
    for (const x of holes[tier] ?? []) {
      s += `<ellipse cx="${x}" cy="${y + 196}" rx="27" ry="4.4" fill="#b8874f" opacity=".6"/>`;
      s += `<path d="M${x - 27},${y + 196} A27,4.4 0 0 1 ${x + 27},${y + 196}" stroke="#8e6034" stroke-width=".8" fill="none" opacity=".6"/>`;
    }
  });
  return svgDocument(
    { x: 0, y: 0, w: rack.width, h: rack.height },
    pixelScale,
    s,
  );
}

/** 試験管より手前にある部分: 板の前面と柱。 */
export function rackFrontSvg(rack: RackGeometry, pixelScale: number): string {
  const { width: w, tierTops } = rack;
  const firstTop = tierTops[0] ?? 0;
  const lastTop = tierTops[tierTops.length - 1] ?? 0;
  let s = `<defs>${woodDefs}</defs>`;
  const boardFront = (x: number, y: number, bw: number, h: number) => {
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="1.5" fill="url(#woodFront)"/>`;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="#000" filter="url(#grain)" opacity=".8"/>`;
    s += `<rect x="${x + 1}" y="${y}" width="${bw - 2}" height="1" fill="#f6e1b8" opacity=".9"/>`;
    s += `<rect x="${x}" y="${y + h - 1}" width="${bw}" height="1" fill="#8a5c2c" opacity=".55"/>`;
  };
  for (const y of tierTops) {
    boardFront(10, y + 30, w - 20, 12);
    s += `<rect x="12" y="${y + 42}" width="${w - 24}" height="4" fill="#3a2610" opacity=".13" filter="url(#blur1)"/>`;
    boardFront(10, y + 202, w - 20, 14);
  }
  const postH = lastTop - firstTop + 206;
  const post = (x: number, fill: string) => {
    s += `<rect x="${x}" y="${firstTop + 14}" width="12" height="${postH}" rx="2" fill="${fill}"/>`;
    s += `<rect x="${x}" y="${firstTop + 14}" width="12" height="${postH}" fill="#000" filter="url(#grainV)" opacity=".5"/>`;
  };
  post(2, "url(#postL)");
  post(w - 14, "url(#postR)");
  s += `<rect x="2" y="${firstTop + 12}" width="12" height="4" rx="2" fill="#f0d6a6"/>`;
  s += `<rect x="${w - 14}" y="${firstTop + 12}" width="12" height="4" rx="2" fill="#e5c793"/>`;
  s += `<rect x="13" y="${firstTop + 16}" width="1" height="${postH - 2}" fill="#7a5129" opacity=".35"/>`;
  s += `<rect x="${w - 14}" y="${firstTop + 16}" width="1" height="${postH - 2}" fill="#fff3d8" opacity=".25"/>`;
  return svgDocument(
    { x: 0, y: 0, w: rack.width, h: rack.height },
    pixelScale,
    s,
  );
}

export function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return image.decode().then(() => image);
}

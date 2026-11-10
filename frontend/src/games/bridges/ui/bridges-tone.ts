import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";

/**
 * ブリッジパズル固有の色。題材の海・島・木の橋から選び、共通UIの意味色（`primary`・`error` など）は流用しない。
 * - 海は盤面の周りから盤面の地まで、ブランドの帯と見出しの後ろまで同じ色でつなげる。ライトは浅い青緑、ダークは深い紺青にする。
 *   平常時は動かさず、白い波の印を淡く散らした静かな水面にする。
 * - 島は海より明るい陸にし、陸の周りの浅瀬の輪と、陸の下の影で海から浮かせる。
 * - 橋は木の板にする。欄干の濃い茶で縁取った板を、継ぎ目を刻んで描く。ダークでも海・島・橋の明度差を 2:1 以上にする
 *   （海と砂の島 9.8:1、海と橋 3.3:1、砂の島と橋 3.0:1、緑の島と橋 2.4:1）。
 * - 交わる橋に阻まれたときは、阻んだ橋を多すぎの島と同じ薔薇色で短く点ける（規則に合わないものの色）。
 * - 島から架けられる相手への線（なぞる間と、島を選んでいる間）は、どの状態とも紛れない空色にし、板の上でも読めるよう
 *   明るい縁（ダークは暗い縁）で囲む。
 * - 全島がつながった瞬間は、橋に沿って走る光と、灯る島の暖かい光にする。完成した盤面を、解く間のどの盤面より明るく見せる。
 */
export const bridgesToneClassNames = {
  sea: "bg-[#8ccbd2] dark:bg-[#0f2c3b]",
  seaFill: "fill-[#8ccbd2] dark:fill-[#0f2c3b]",
  /** 海の上の、動かない波の印。 */
  seaWave: "stroke-white/35 dark:stroke-[#5d9db3]/30",
  seaRipple: "stroke-[#f2fbfb] dark:stroke-[#9fdbe8]",
  shallows: "fill-[#bfe6e6] dark:fill-[#1a4556]",
  islandShadow: "fill-[#2f6b74]/35 dark:fill-black/45",
  bridgeShadow: "stroke-[#2f6b74]/30 dark:stroke-black/40",
  bridgeRail: "stroke-[#6e4523] dark:stroke-[#5e3a1b]",
  bridgeDeck: "stroke-[#b47c46] dark:stroke-[#a06c3a]",
  bridgeSeam: "stroke-[#87562b] dark:stroke-[#7a5028]",
  blockingBridge: "stroke-rose-500 dark:stroke-rose-400",
  guideCasing: "stroke-white/85 dark:stroke-[#0b2230]/85",
  guide: "stroke-sky-600 dark:stroke-sky-300",
  focusRing: "stroke-sky-700 dark:stroke-sky-300",
  clearGlowHalo: "stroke-[#fff1a8]/55 dark:stroke-[#ffe27a]/60",
  clearGlowCore: "stroke-[#fffdf0]/90 dark:stroke-[#fff8d6]/90",
  clearIslandHalo: "fill-[#fff3b0]/80 dark:fill-[#ffe27a]/45",
} as const;

/**
 * 島の状態ごとの陸の姿。色だけに頼らず、縁の形でも分ける。
 * - `short`（足りない）: 砂の陸に細い砂色の縁。
 * - `exact`（ちょうど）: 草の茂った緑の陸に太い縁と、内側の明るい輪。整った島として、砂の陸より彩りを増す。
 * - `over`（多すぎ）: 薔薇色の陸に、途切れた太い縁。
 * - `rimDash`: 縁を途切れさせる間隔（マス幅を 1 とした値）。途切れない縁は持たない。
 * - `innerRing`: 内側の輪の色。輪の無い状態は持たない。
 * 数字と陸の輝度比: 足りない 10.1:1、ちょうど 7.8:1、多すぎ 5.9:1（ダークは 9.5:1、7.3:1、8.3:1）。
 */
export type BridgesIslandTone = {
  land: string;
  rim: string;
  clue: string;
  rimWidth: number;
  rimDash?: string;
  innerRing?: string;
};

export const bridgesIslandTones: Readonly<
  Record<BridgesIslandStatus, BridgesIslandTone>
> = {
  short: {
    land: "fill-[#f8ecd0] dark:fill-[#e6d3a3]",
    rim: "stroke-[#a9824a] dark:stroke-[#a7834c]",
    clue: "fill-[#4a3218] dark:fill-[#3a2810]",
    rimWidth: 0.045,
  },
  exact: {
    land: "fill-[#c6eca2] dark:fill-[#8ccf6c]",
    rim: "stroke-[#4e9a3a] dark:stroke-[#d4f5b5]",
    clue: "fill-[#1d4a17] dark:fill-[#123510]",
    rimWidth: 0.08,
    innerRing: "stroke-white/80 dark:stroke-[#e9fbd9]/70",
  },
  over: {
    land: "fill-[#ffd4cf] dark:fill-[#fda4af]",
    rim: "stroke-[#e0475e] dark:stroke-[#fb7185]",
    clue: "fill-[#9f1239] dark:fill-[#4c0519]",
    rimWidth: 0.08,
    rimDash: "0.13 0.08",
  },
};

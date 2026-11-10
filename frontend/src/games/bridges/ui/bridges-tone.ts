import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";

/**
 * ブリッジパズル固有の色。題材の海・島・木の橋から選び、共通UIの意味色（`primary`・`error` など）は流用しない。
 * 色は役割ごとに1つにし、同じ色を別の部品で使い回す（杭と横木は欄干の色、ロープの輪はロープの色、灯りの杭は灯りの色、
 * 阻んだ橋は多すぎの縁の色、波紋は波打ち際の泡の色、予告の板の影は板の色）。
 * - 海は盤面の周りから盤面の地まで、ブランドの帯と見出しの後ろまで同じ色でつなげる。解く間は彩度を抑えた明るい青緑
 *   （ダークは深い青緑）にし、ほかのゲームの低彩度の地と並べても盤面より前に出さない。
 *   ダークの海はページの地と 1.8:1 ほど離し、黒い地に沈ませない。
 * - 島の周りの浅瀬は、陸と海の間の狭い帯にする。陸より明るさを 1.3:1 以上落とし、平常時の島を光って見せない。
 * - 島は砂浜の陸にし、陸の縁の濡れた砂、波打ち際の白い泡、浅瀬の順に海へつなげる。影は落とさず、円盤やボタンに見せない。
 *   ダークの陸は海と 5:1 ほどにとどめ、まぶしくしない。
 * - 橋は木の板にする。欄干の濃い茶で縁取った板に淡い横木を間引いて刻み、両端の浅瀬に杭を立てる。
 *   ダークでも欄干と海を 2:1 以上離す。
 * - 交わる橋に阻まれたときは、阻んだ橋の板を多すぎの島の縁と同じ薔薇色で縁取る（規則に合わないものの色）。
 * - 島から架けられる相手へ張るロープ（なぞる間と、島を選んでいる間）は、海・板・どの島の状態とも紛れない紺（ダークは白）にし、
 *   板の上でも読めるよう反対の明るさの縁で囲む。離せば架かる辺には、架かった後の板の影を半透明で置く。
 * - 全島がつながった瞬間は、島が灯り、島の周りの浅瀬が海と同じ色相のまま鮮やかに澄む。解く間に抑えていた彩度を、
 *   完成した盤面の島ごとに解放する。画面全体の海の色は変えず、ブランドの帯と見出しの後ろの海とつないだままにする。
 *   澄んだ浅瀬は陸と 1.5:1 以上離し、島を海に溶かさない。
 */
export const bridgesToneClassNames = {
  sea: "bg-[#8cc3cb] dark:bg-[#18404f]",
  seaFill: "fill-[#8cc3cb] dark:fill-[#18404f]",
  /** 海の上の、動かない波の印。 */
  seaWave: "stroke-white/45 dark:stroke-[#d9f3f2]/30",
  /** 島の周りの浅瀬。島から離れるほど透けて海の色に戻す。 */
  shallowsStop: "[stop-color:#a9d6d6] dark:[stop-color:#235566]",
  /** 島を触っている間に示す、同じ行と列の淡い浅瀬。 */
  shallowsFill: "fill-[#a9d6d6] dark:fill-[#235566]",
  /** 全島がつながった後の、灯った島の周りの澄んだ浅瀬。海と同じ色相で彩度だけを上げる。 */
  litShallowsStop: "[stop-color:#5ecdde] dark:[stop-color:#266d82]",
  litShallowsStroke: "stroke-[#5ecdde] dark:stroke-[#266d82]",
  /** 陸の縁の、濡れて色の濃い砂。 */
  wetSand: "stroke-[#d6b77c] dark:stroke-[#a8955f]",
  /** 波打ち際。途切れない細い白い線にし、途切れた縁（多すぎの島）と形で分ける。 */
  surf: "stroke-white/85 dark:stroke-[#d9f3f2]/70",
  bridgeShadow: "stroke-[#1f5a63]/30 dark:stroke-black/40",
  bridgeRail: "stroke-[#6e4523] dark:stroke-[#94663a]",
  bridgeDeck: "stroke-[#ba844c] dark:stroke-[#c99358]",
  bridgeSeam: "stroke-[#6e4523]/45 dark:stroke-[#6e4523]/45",
  /** 橋の両端の杭。 */
  bridgePost: "fill-[#6e4523] dark:fill-[#94663a]",
  blockingBridge: "stroke-[#e0475e] dark:stroke-[#fb7185]",
  guideCasing: "stroke-white/90 dark:stroke-[#06202b]/90",
  guide: "stroke-[#0f4466] dark:stroke-white",
  /** 離せば架かる板の影。阻まれた辺に架かるはずだった板は、板そのものを半透明にして見せる。 */
  guideGhost: "stroke-[#ba844c]/55 dark:stroke-[#c99358]/55",
  /** 離せば外れる板に重ねる、海の色の覆い。 */
  guideRemoval: "stroke-[#8cc3cb]/75 dark:stroke-[#18404f]/75",
  /** 灯った島の、陸の後ろの暖かい光と杭の灯り。 */
  lanternStop: "[stop-color:#f5b82e]",
  lanternPost: "fill-[#f5b82e]",
  /** 灯った島から海へ広がる波紋。 */
  ripple: "stroke-white dark:stroke-[#d9f3f2]",
} as const;

/**
 * 島の状態ごとの陸の姿。色だけに頼らず、形でも分ける。
 * - `short`（足りない）: 砂の陸だけ。
 * - `exact`（ちょうど）: 砂の縁を残して、中に草地が広がる。陸の輪郭は変えず、内側の草地の有無で見分ける。
 * - `over`（多すぎ）: 薔薇色の陸に、途切れた太い縁。陸の明るさも通常の陸より 1.3:1 以上落とし、縁の形だけに頼らない。
 * - `grass`: 草地の色。草地の無い状態は持たない。
 * - `rimDash`: 陸の縁を途切れさせる間隔（マス幅を 1 とした値）。途切れない縁は持たない。
 */
export type BridgesIslandTone = {
  land: string;
  clue: string;
  grass?: string;
  rim?: string;
  rimDash?: string;
};

export const bridgesIslandTones: Readonly<
  Record<BridgesIslandStatus, BridgesIslandTone>
> = {
  short: {
    land: "fill-[#f7e8c6] dark:fill-[#c4b184]",
    clue: "fill-[#4a3218]",
  },
  exact: {
    land: "fill-[#f7e8c6] dark:fill-[#c4b184]",
    grass: "fill-[#7fca55] dark:fill-[#4d9733]",
    clue: "fill-[#123a0e] dark:fill-[#0a2006]",
  },
  over: {
    land: "fill-[#f2b3ae] dark:fill-[#b98b85]",
    rim: "stroke-[#e0475e] dark:stroke-[#fb7185]",
    rimDash: "0.13 0.08",
    clue: "fill-[#9f1239] dark:fill-[#4c0519]",
  },
};

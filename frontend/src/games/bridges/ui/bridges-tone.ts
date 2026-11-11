import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";

/**
 * ブリッジパズル固有の色。題材の海・島・木の橋から選び、共通UIの意味色（`primary`・`error` など）は流用しない。
 * 色は役割ごとに1つにし、同じ色を別の部品で使い回す（杭と横木は欄干の色、ロープの輪はロープの色、灯りの杭は灯りの色、
 * 阻んだ橋は多すぎの縁の色、波紋は波打ち際の泡の色、予告の板の影は板の色）。
 * - 海は盤面の周りから盤面の地まで、ブランドの帯と見出しの後ろまで同じ色でつなげる。解く間は彩度を抑えた青緑
 *   （ダークは深い青緑）にし、ほかのゲームの低彩度の地と並べても盤面より前に出さない。ライトの海は陸と 2.2:1 以上離し、
 *   波打ち際の線に頼らず島を海から浮かせる。ダークの海はページの地と 1.8:1 ほど離し、黒い地に沈ませない。
 * - 海には、深さの差の弱い明暗のむらと、まばらな波の印を動かさずに置く。盤面のマスの中心には、島の無い所にだけ
 *   ごく薄い点を打ち、島が縦横に並んでいることを読めるようにする。
 * - 島の周りの浅瀬は、陸と海の間の狭い帯にする。陸より明るさを 1.3:1 以上落とし、平常時の島を光って見せない。
 * - 島は砂浜の陸にし、陸の縁の太い濡れた砂、波打ち際の白い泡、浅瀬の順に海へつなげる。影は落とさず、輪郭を揺らして、円盤や
 *   ボタンに見せない。
 *   ダークの陸は海と 5:1 ほどにとどめ、まぶしくしない。
 * - 橋は木の板にする。欄干の濃い茶で縁取った板に淡い横木を間引いて刻み、両端の浅瀬に杭を立てる。
 *   ライトの板の面は海と 2:1 以上、ダークでも欄干と海を 2:1 以上離す。
 * - 交わる橋に阻まれたときは、押した所から伸びた板が阻んだ橋に突き当たって弾かれる動きで返し、阻んだ橋の板を
 *   明るい薔薇色に白い縁で太く縁取って一瞬点け、板ごと揺らす（規則に合わないものの色）。続く状態の多すぎ（濃い薔薇色の陸）とは、
 *   点いて消える動きと揺れで分ける。
 * - 島から架けられる相手へ張るロープ（なぞる間と、島を選んでいる間）は、海・板・どの島の状態とも紛れない紺（ダークは白）にし、
 *   板の上でも読めるよう反対の明るさの縁で囲む。ロープの下には、相手の島までの区間だけ同じ色の半透明の帯を敷く。
 *   離せば架かる辺には、架かった後の板の影を半透明で置く。
 * - 全島がつながった瞬間は、島が灯り、島の周りの浅瀬が海と同じ色相のまま明るく澄み、橋は杭の灯りが順に点いて板が一瞬
 *   明るい木の色になる。光らせるのは島の周りだけにし、橋に沿って光らせない。画面全体の海の色は変えず、ブランドの帯と
 *   見出しの後ろの海とつないだままにする。澄んだ浅瀬は海と明るさで 1.6:1 以上離し、陸とも 1.3:1 以上離して島を溶かさない。
 */
export const bridgesToneClassNames = {
  sea: "bg-[#72aebb] dark:bg-[#18404f]",
  seaFill: "fill-[#72aebb] dark:fill-[#18404f]",
  /** 海の上の、動かない波の印。 */
  seaWave: "stroke-white/55 dark:stroke-[#d9f3f2]/35",
  /** 海の深さの差の、弱い明暗のむら。浅い所は明るく、深い所は暗く、どちらも海の色の上に薄く重ねる。 */
  seaShoal: "[stop-color:#ffffff] dark:[stop-color:#3f7f8c]",
  seaDeep: "[stop-color:#1d5a68] dark:[stop-color:#06202b]",
  /** 盤面のマスの中心の、島の無い所に打つ点。 */
  gridDot: "fill-white/35 dark:fill-[#d9f3f2]/20",
  /** チュートリアルで見る所を絞っている間に、海に重ねる深い海の色。灰色の覆いの代わりに、海の色のまま暗くする。 */
  focusVeil: "fill-[#0e3d4a] dark:fill-[#03141b]",
  /** 島の周りの浅瀬。島から離れるほど透けて海の色に戻す。 */
  shallowsStop: "[stop-color:#8fc3cb] dark:[stop-color:#235566]",
  /** 全島がつながった後の、灯った島の周りの澄んだ浅瀬。海と同じ色相で、明るさも上げる。 */
  litShallowsStop: "[stop-color:#a6dfe4] dark:[stop-color:#2f7686]",
  /** 陸の縁の、濡れて色の濃い砂。 */
  wetSand: "stroke-[#c9a35e] dark:stroke-[#a8955f]",
  /** 波打ち際。途切れない細い白い線にし、途切れた縁（多すぎの島）と形で分ける。 */
  surf: "stroke-white/85 dark:stroke-[#d9f3f2]/70",
  bridgeShadow: "stroke-[#1f5a63]/30 dark:stroke-black/40",
  bridgeRail: "stroke-[#5a361a] dark:stroke-[#94663a]",
  bridgeDeck: "stroke-[#9e6a3a] dark:stroke-[#c99358]",
  bridgeSeam: "stroke-[#5a361a]/45 dark:stroke-[#6e4523]/45",
  /** 全島がつながったときに、板が一瞬なる明るい木の色。 */
  bridgeDeckLit: "stroke-[#e2b277] dark:stroke-[#eec48a]",
  /** 橋の両端の杭。 */
  bridgePost: "fill-[#5a361a] dark:fill-[#94663a]",
  blockingBridge: "stroke-[#ff5c7a] dark:stroke-[#ff7a91]",
  /** 阻んだ橋の縁取りの外側の白い縁。板や海のどちらの上でも縁取りを浮かせる。 */
  blockingCasing: "stroke-white dark:stroke-[#fff1f3]",
  guideCasing: "stroke-white/90 dark:stroke-[#06202b]/90",
  guide: "stroke-[#0f4466] dark:stroke-white",
  /** ロープの下に、相手の島までの区間だけ敷く帯。 */
  guideBand: "fill-[#0f4466]/15 dark:fill-white/12",
  /** 離せば架かる板の影。阻まれた辺に架かるはずだった板は、板そのものを半透明にして見せる。 */
  guideGhost: "stroke-[#9e6a3a]/55 dark:stroke-[#c99358]/55",
  /** 離せば外れる板に重ねる、海の色の覆い。 */
  guideRemoval: "stroke-[#72aebb]/75 dark:stroke-[#18404f]/75",
  /** 灯った島の、陸の後ろの暖かい光と杭の灯り。 */
  lanternStop: "[stop-color:#f5b82e]",
  lanternPost: "fill-[#f5b82e]",
  /** 灯った島から海へ広がる波紋。 */
  ripple: "stroke-white dark:stroke-[#d9f3f2]",
} as const;

/**
 * 島の状態ごとの陸の姿。色だけに頼らず、形でも分ける。
 * - `short`（足りない）: 砂の陸だけ。
 * - `exact`（ちょうど）: 海岸線と同じ輪郭の草地が、砂の縁を細く残して陸に広がる。陸の輪郭は変えず、草地の有無で見分ける。草地は陸と 2:1 以上離し、
 *   ダークでは暗い草地に明るい数字を置く。
 * - `over`（多すぎ）: 濃い薔薇色の陸に明るい数字と、淡い途切れた太い縁。陸は海と 1.8:1 以上離し、通常の陸より目立たせる。
 *   色だけでなく、陸の明るさの逆転（ライトでは陸が海より暗い）と縁の形でも分ける。
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
    land: "fill-[#fff4d8] dark:fill-[#c4b184]",
    clue: "fill-[#4a3218]",
  },
  exact: {
    land: "fill-[#fff4d8] dark:fill-[#c4b184]",
    grass: "fill-[#68b040] dark:fill-[#347024]",
    clue: "fill-[#123a0e] dark:fill-[#ecfccb]",
  },
  over: {
    land: "fill-[#c2405a] dark:fill-[#ec6f83]",
    rim: "stroke-[#ffd6dc] dark:stroke-[#ffd6dc]",
    rimDash: "0.14 0.08",
    clue: "fill-white dark:fill-[#4c0519]",
  },
};

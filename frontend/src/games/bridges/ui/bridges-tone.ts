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
 * - 島はほかのゲームの盤面の記号と同じ平らな記号にする。揺らぎの無い真円に平らな塗り1色と輪郭線だけを置き、影・グラデーション・
 *   砂や草の質感・浅瀬の輪は描かない。島は立体に見せず、塗りと輪郭線の色と明るさの差だけで海と橋の中で際立たせる。
 *   ライトは明るい塗りを海の 2.4:1 以上にし、濃い輪郭線（海と 5:1）で縁を切る。ダークは明るい塗りを海の 7:1 ほどにする。
 * - 橋は木の板にする。欄干の濃い茶で縁取った板に淡い横木を間引いて刻み、両端の浅瀬に杭を立てる。
 *   ライトの板の面は海と 2:1 以上、ダークでも欄干と海を 2:1 以上離す。
 * - 交わる橋に阻まれたときは、押した所から伸びた板が阻んだ橋に突き当たって弾かれる動きで返し、阻んだ橋の板を
 *   明るい薔薇色に白い縁で太く縁取って一瞬点け、板ごと揺らす（規則に合わないものの色）。続く状態の多すぎ（濃い薔薇色の陸）とは、
 *   点いて消える動きと揺れで分ける。
 * - 島から架けられる相手へ張るロープ（なぞる間と、島を選んでいる間）は、海・板・どの島の状態とも紛れない紺（ダークは白）にし、
 *   板の上でも読めるよう反対の明るさの縁で囲む。ロープの下には、相手の島までの区間だけ同じ色の半透明の帯を敷く。
 *   離せば架かる辺には、架かった後の板の影を半透明で置く。
 * - 全島がつながった瞬間は、島が灯り、島の周りの水が海と同じ色相のまま明るく澄み、橋は杭の灯りが順に点いて板が一瞬
 *   明るい木の色になる。光らせるのは島の周りだけにし、橋に沿って光らせない。画面全体の海の色は変えず、ブランドの帯と
 *   見出しの後ろの海とつないだままにする。澄んだ水は海と明るさで 1.6:1 以上離し、島の輪郭線で島を溶かさない。
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
  /** 全島がつながった後の、灯った島の周りの澄んだ水。海と同じ色相で、明るさも上げる。 */
  litShallowsStop: "[stop-color:#a6dfe4] dark:[stop-color:#2f7686]",
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
 * 島の状態ごとの、平らな塗りと輪郭線と数字の色。色だけに頼らず、塗りの明るさと形でも分ける。数字は塗りと 6.5:1 以上離す。
 * - `short`（足りない）: 砂浜の色の無地の塗りに濃い数字（ライト 10:1）。
 * - `exact`（ちょうど）: 達成で色を解放する考え方で、砂浜の色から緑豊かな濃い緑の塗りに変わり、白い数字（ライト 5:1）。足りない島より暗く（2.3:1 以上）、色でも整った表情にする。
 * - `over`（多すぎ）: 濃い薔薇色の塗りに白い数字と、輪郭線の内側の淡い途切れた輪。続く状態として最も暗い塗りにし、輪の形でも分ける。
 * - `outline`: 島の縁を切る輪郭線。ライトは海と 5:1 の濃い線、ダークは海より暗い線で、明るい塗りの縁を締める。
 * - `rim`: 多すぎの島の途切れた輪の色。輪の無い状態は持たない。
 */
export type BridgesIslandTone = {
  land: string;
  outline: string;
  clue: string;
  rim?: string;
};

const islandOutline = "stroke-[#163843] dark:stroke-[#0b1d24]";

export const bridgesIslandTones: Readonly<
  Record<BridgesIslandStatus, BridgesIslandTone>
> = {
  short: {
    land: "fill-[#f7e8c6] dark:fill-[#d8c49a]",
    outline: islandOutline,
    clue: "fill-[#163843] dark:fill-[#10262d]",
  },
  exact: {
    land: "fill-[#2a7f26] dark:fill-[#5aac45]",
    outline: islandOutline,
    clue: "fill-white dark:fill-[#0b2e13]",
  },
  over: {
    land: "fill-[#a8243e] dark:fill-[#a8324c]",
    outline: islandOutline,
    rim: "stroke-[#ffd6dc]",
    clue: "fill-white",
  },
};

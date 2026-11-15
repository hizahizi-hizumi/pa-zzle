import { ISLAND_RADIUS } from "@/games/bridges/ui/board/board-geometry";

/** 演出が図の部品を探すための属性。明るい木の色の板の値は、その板へ光が渡り始める段数。 */
export const bridgesFigureParts = {
  island: "data-bridges-island",
  bridgeEdge: "data-bridges-edge",
  bridgePlank: "data-bridges-plank",
  plankShadow: "data-bridges-plank-shadow",
  retracting: "data-bridges-retracting",
  bridgeAxis: "data-bridges-edge-axis",
  blockingOutline: "data-bridges-blocking",
  blockedAttempt: "data-bridges-blocked-attempt",
  litDeck: "data-bridges-lit-deck",
  rope: "data-bridges-rope",
  candidateHint: "data-bridges-candidate-hint",
  pressedEdge: "data-bridges-pressed-edge",
} as const;

export const PLANK_RAIL_WIDTH = 0.035;
/** 板の横木の太さと間隔。板の幅ほどの間を空けて間引き、梯子や線路の枕木に見せない。 */
export const PLANK_SEAM_DASH = "0.025 0.155";
/** 板の影を落とす向き。光を左上から当て、右下へ落とす。 */
export const SHADOW_OFFSET = { x: 0.02, y: 0.045 } as const;
/** 杭の半径と、島の中心から杭までの距離。杭は島の輪郭線のすぐ外に立て、10×10 のスマホでも点でなく杭に見える太さにする。 */
export const POST_RADIUS = 0.065;
export const POST_DISTANCE = ISLAND_RADIUS + 0.1;
export const GUIDE_BAND_WIDTH = 0.56;
export const GRID_DOT_RADIUS = 0.05;
/**
 * 島の輪郭線の太さ。10×10 のスマホでも 2px ほどの線にし、塗りが海や橋と近い明るさになる状態でも島の縁を切り出す。
 */
export const ISLAND_OUTLINE_WIDTH = 0.06;
export const OVER_RIM_RADIUS = ISLAND_RADIUS - 0.07;
export const OVER_RIM_WIDTH = 0.07;
export const OVER_RIM_DASH = "0.12 0.07";
/** 阻んだ橋の板の外側に、片側に見せる薔薇色の縁取りの幅と、その外の白い縁の幅。 */
export const BLOCKING_OUTLINE_SIDE = 0.12;
export const BLOCKING_CASING_SIDE = 0.03;
export const ROPE_WIDTH = 0.12;
export const ROPE_DASH = "0.15 0.07";
export const PREVIEW_ROPE_WIDTH = 0.12;
/** 板の影を、板より少し太く描く分。ロープを上に重ねても、ロープの両脇に影が見える。 */
export const GHOST_EXTRA_WIDTH = 0.08;
export const ROPE_CASING_EXTRA = 0.07;
export const REMOVAL_EXTRA_WIDTH = 0.04;
/** なぞっている間、指の向いた辺のほかのロープの濃さ。 */
export const UNFOCUSED_ROPE_OPACITY = 0.35;
export const HOVER_GHOST_OPACITY = 0.6;
export const SELECTION_RING_RADIUS = ISLAND_RADIUS + 0.1;
/** 離せば回す辺の相手の島を囲む輪。指で隠れても輪の外側が見える大きさにする。 */
export const TARGET_RING_RADIUS = ISLAND_RADIUS + 0.16;
export const TARGET_RING_WIDTH = 0.09;
export const FOCUS_RING_RADIUS = ISLAND_RADIUS + 0.17;
export const FOCUS_RING_WIDTH = 0.05;
export const FOCUS_VEIL_OPACITY = 0.38;
export const UNFOCUSED_OPACITY = 0.4;
/** 阻まれた辺に架かるはずだった板の濃さ。板そのものを透かし、下の海が見える濃さにする。 */
export const BLOCKED_ATTEMPT_OPACITY = 0.5;

/**
 * 数字の字の大きさ。島の直径の6割ほどにし、10×10 のスマホで 20px ほど（ナンプレの盤面の数字と同じ大きさ）にする。
 */
export const CLUE_FONT_SIZE = 0.55;
/**
 * 数字を島の中心にそろえる、文字の大きさに対する基線の下げ幅。iOS の Safari は小さな文字の
 * dominant-baseline="central" を上へずらして描くので使わず、数字の高さ（約 0.72em）の半分だけ基線を下げる。
 */
export const CLUE_BASELINE_OFFSET = 0.36;
/** 絵の中の海の波の印の、区画の寸法に掛ける倍率。マス幅の 1/40 を 1 とする。 */
export const FIGURE_WAVE_UNIT = 1 / 40;

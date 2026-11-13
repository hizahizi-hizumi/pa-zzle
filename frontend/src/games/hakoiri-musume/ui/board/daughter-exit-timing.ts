/**
 * 目標の駒（娘）が行き先に着いたとき、指へ寄せて見せていたずれをマスへ収め、持ち上げた駒を箱の底へ下ろす時間。
 */
export const DAUGHTER_EXIT_SETTLE_MS = 150;

/** 収まった娘を出口の前に止めて見せてから、抜け始めるまでの間。 */
const DAUGHTER_EXIT_PAUSE_MS = 200;

/**
 * クリアしてから娘が出口へ抜け始めるまでの時間。盤面の演出と、娘が出口の縁をこすって抜けていく音で共有する。
 */
export const DAUGHTER_EXIT_START_MS =
  DAUGHTER_EXIT_SETTLE_MS + DAUGHTER_EXIT_PAUSE_MS;

/** 娘が出口の前から、縁の切り欠きを抜けて箱の外へ出ていく時間。 */
export const DAUGHTER_EXIT_MS = 700;

/**
 * クリアしてから、抜け切った娘が箱の外へ落ちるまでの時間。箱の沈みと、落ちたごとんの音で共有する。
 */
export const DAUGHTER_LANDING_MS = DAUGHTER_EXIT_START_MS + DAUGHTER_EXIT_MS;

/**
 * 動きを減らす設定で、出口の前に着いた娘を止めたまま見せてから、箱から消すまでの時間。消すのと同時に、箱の外へ落ちる音を鳴らす。
 */
export const REDUCED_MOTION_DAUGHTER_EXIT_MS = 450;

/** 目標が2つのとき、1つ目が抜け切ってから2つ目が抜け始めるまでの間。落ちたごとんを1つずつ聞き分けられる長さ。 */
const DAUGHTER_EXIT_SEQUENCE_GAP_MS = 150;

/** `order` 番目（0 始まり）に抜ける目標の駒が、クリアしてから抜け始めるまでの時間。目標の駒は1つずつ順に抜ける。 */
export function getDaughterExitStartMs(order: number): number {
  return (
    DAUGHTER_EXIT_START_MS +
    order * (DAUGHTER_EXIT_MS + DAUGHTER_EXIT_SEQUENCE_GAP_MS)
  );
}

/** `order` 番目に抜ける目標の駒が、クリアしてから抜け切って箱の外へ落ちるまでの時間。 */
export function getDaughterLandingMs(order: number): number {
  return getDaughterExitStartMs(order) + DAUGHTER_EXIT_MS;
}

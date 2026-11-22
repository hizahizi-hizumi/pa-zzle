/** 空の試験管を1本ずつ試験管立てから抜いて片付ける間合いと、1本にかける時間。抜く音もこの間合いで鳴らす。 */
export const CLEAR_FINALE_PUT_AWAY_STAGGER_MS = 60;
export const CLEAR_FINALE_PUT_AWAY_DURATION_MS = 380;

/**
 * 片付け終わる頃から、栓をした試験管の列を窓の光が端から順に撫でていく。撫で始めに試験管どうしが鳴り合う。
 * 本数が多くても列を撫で終える時間が延びないよう、撫で始めの間合いは列全体で `CLEAR_FINALE_GLEAM_SPREAD_MS` に収める。
 */
export const CLEAR_FINALE_GLEAM_DELAY_MS = 300;
export const CLEAR_FINALE_GLEAM_MAX_STAGGER_MS = 45;
export const CLEAR_FINALE_GLEAM_SPREAD_MS = 360;
export const CLEAR_FINALE_GLEAM_DURATION_MS = 460;

/** 光が撫で終えてから演出を終えるまで、整った列を眺める時間。 */
export const CLEAR_FINALE_HOLD_MS = 600;

/** 動きを減らす設定で、そろった姿を見せておく時間。 */
export const CLEAR_FINALE_REDUCED_MOTION_HOLD_MS = 1400;

/** 片付けを終える時刻。 */
export function getClearFinalePutAwayEndMs(emptyCount: number): number {
  return emptyCount === 0
    ? 0
    : (emptyCount - 1) * CLEAR_FINALE_PUT_AWAY_STAGGER_MS +
        CLEAR_FINALE_PUT_AWAY_DURATION_MS;
}

/** 光が列を撫で始める時刻。片付けの終わり際に重ねる。 */
export function getClearFinaleGleamStartMs(emptyCount: number): number {
  return Math.max(
    CLEAR_FINALE_GLEAM_DELAY_MS,
    getClearFinalePutAwayEndMs(emptyCount) - 160,
  );
}

/** 栓をした試験管ごとに、光が撫で始める間合い。 */
export function getClearFinaleGleamStaggerMs(sealedCount: number): number {
  return sealedCount <= 1
    ? 0
    : Math.min(
        CLEAR_FINALE_GLEAM_MAX_STAGGER_MS,
        CLEAR_FINALE_GLEAM_SPREAD_MS / (sealedCount - 1),
      );
}

/** 最後の注ぎを終えてから演出を終えるまでの長さ。 */
export function getClearFinaleDurationMs(
  emptyCount: number,
  sealedCount: number,
): number {
  return (
    getClearFinaleGleamStartMs(emptyCount) +
    getClearFinaleGleamStaggerMs(sealedCount) * Math.max(0, sealedCount - 1) +
    CLEAR_FINALE_GLEAM_DURATION_MS +
    CLEAR_FINALE_HOLD_MS
  );
}

/**
 * 注ぐ動き1回の時刻（動きの始まりからの ms）。注ぐ時間だけを量で変え、持って行く・戻す・栓を差す長さは量によらない。
 * 1段は約0.9秒、3段は約1.4秒。レベル5では1問に40〜50回注ぐので、1回を短く保つ。
 */
export type PourTiming = {
  /** 注ぎ元の口が注ぎ先の口に触れ、液が口から出始める所。 */
  touchMs: number;
  /** 注ぎ元の口から液が出終える所。 */
  flowEndMs: number;
  /** 流れの先が注ぎ先の液面（空なら底）に届く所。注ぐ音もここから鳴らす。 */
  landStartMs: number;
  /** 流れの最後が注ぎ先の液面に届く所。 */
  landEndMs: number;
  /** そろった注ぎ先にゴム栓を差し込み始める所と、栓が奥まで入る所。 */
  stopperStartMs: number;
  stopperSeatedMs: number;
  /** 試験管立てに戻し終える少し前に、試験管ばさみを離す所。 */
  clampReleaseMs: number;
  durationMs: number;
};

/** 持ち上げた所から、傾けながら注ぎ先の口まで持って行く長さ。 */
const TRAVEL_MS = 300;
/** 口から液が出ている長さは、段の数に比例させ、出始めと出終わりの細い流れの分を足す。 */
const FLOW_BASE_MS = 60;
/** 1段を注ぐ長さ。流れ込む音も、1段ごとの音をこの間ずつずらして重ねる。 */
export const POUR_FLOW_PER_SLOT_MS = 240;
/** 口から出た液が注ぎ先の液面まで落ちる長さ。 */
export const POUR_FALL_MS = 70;
/** 注ぎ終えてから、起こして置かれていた所へ戻すまで。 */
const RETURN_MS = 320;
/** 流れの最後が届いてから、栓を差し始めるまでの間。 */
const STOPPER_LEAD_MS = 30;
const STOPPER_INSERT_MS = 140;
const CLAMP_RELEASE_LEAD_MS = 60;

export function getPourTiming(slotCount: number): PourTiming {
  const touchMs = TRAVEL_MS;
  const flowEndMs = touchMs + FLOW_BASE_MS + POUR_FLOW_PER_SLOT_MS * slotCount;
  const landEndMs = flowEndMs + POUR_FALL_MS;
  const stopperStartMs = landEndMs + STOPPER_LEAD_MS;
  return {
    touchMs,
    flowEndMs,
    landStartMs: touchMs + POUR_FALL_MS,
    landEndMs,
    stopperStartMs,
    stopperSeatedMs: stopperStartMs + STOPPER_INSERT_MS,
    clampReleaseMs: flowEndMs + RETURN_MS - CLAMP_RELEASE_LEAD_MS,
    durationMs: flowEndMs + RETURN_MS,
  };
}

/** 1回で注げるいちばん多い4段を注ぐ長さ。盤面の外で、どの注ぎにも足りる間合いを取るときに使う。 */
export const LONGEST_POUR_DURATION_MS = getPourTiming(4).durationMs;

/** 流れが太るまでと、細って止むまでの長さ（液が出ている長さに対する割合）。 */
const FLOW_RAMP_IN = 0.18;
const FLOW_RAMP_OUT = 0.25;
const FLOW_AREA = 1 - FLOW_RAMP_IN / 2 - FLOW_RAMP_OUT / 2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 液が出ている間の、流れの太さ（0〜1）。`progress` は液が出ている長さに対する割合。 */
export function getFlowRate(progress: number): number {
  if (progress <= 0 || progress >= 1) {
    return 0;
  }
  return Math.min(1, progress / FLOW_RAMP_IN, (1 - progress) / FLOW_RAMP_OUT);
}

/** 液が出ている間に、移る量のうち出終えた割合（0〜1）。流れの太さを積み上げたもの。 */
export function getFlowedRatio(progress: number): number {
  const p = clamp01(progress);
  const rampOutStart = 1 - FLOW_RAMP_OUT;
  let area: number;
  if (p <= FLOW_RAMP_IN) {
    area = (p * p) / (2 * FLOW_RAMP_IN);
  } else if (p <= rampOutStart) {
    area = FLOW_RAMP_IN / 2 + (p - FLOW_RAMP_IN);
  } else {
    const remaining = 1 - p;
    area = FLOW_AREA - (remaining * remaining) / (2 * FLOW_RAMP_OUT);
  }
  return clamp01(area / FLOW_AREA);
}

/** `elapsedMs` の時点で、注ぎ元の口から出た量の割合。 */
export function getPouredRatio(timing: PourTiming, elapsedMs: number): number {
  return getFlowedRatio(
    (elapsedMs - timing.touchMs) / (timing.flowEndMs - timing.touchMs),
  );
}

/** `elapsedMs` の時点で、注ぎ先に届いた量の割合。口から出た液は落ちる分だけ遅れて届く。 */
export function getLandedRatio(timing: PourTiming, elapsedMs: number): number {
  return getPouredRatio(timing, elapsedMs - POUR_FALL_MS);
}

import { calculateLinearScore, subtractWithFloor } from "@/games/score";
import type { TsumeShogiSolveWorkload } from "@/games/tsume-shogi/problem/problem";

/**
 * 王手の候補を読み比べ、誤王手を指さずに速く詰ますプレイを称える。読みの確かさ20点と速さ80点の100点満点にする。
 * - 読みの確かさ: 誤王手（作意・詰み筋の上から指した、残りの手数以内に詰まない王手）1回ごとに減点し、4回で0点。
 *   誤王手は玉方の反証を盤面で見て考え直す体験でもあるので、何回指しても読みの確かさの20点を超えては減らさない。
 *   1回でも指すと `perfect` には届かないが、速ければ `great` に残る。
 * - 速さ: 問題ごとの基準時間以内で満点、基準時間の3倍で0点。
 * 反証を見た回数・元に戻した回数（誤王手の筋から判断地点へ戻ったときを含む）・盤面を戻した回数は減点しない。どれも誤王手の後の考え直しか、
 * 正しい筋の確かめ直しで、かかった時間は速さに表れる。指せない手を押した回数（非合法入力）は入力の摩擦を見る診断用で、
 * 評価に使わない。
 * 係数はすべて実プレイで確かめる前の仮置き（`詰将棋成績評価.md`）。
 */
export const TSUME_SHOGI_SCORE_MAXIMUMS = {
  accuracy: 20,
  speed: 80,
} as const;

/** 誤王手1回ごとの読みの確かさの減点（仮置き）。4回で読みの確かさが0点になる。 */
export const TSUME_SHOGI_WRONG_CHECK_PENALTY = 5;

/** 基準時間の係数（仮置き）。盤面と持駒を見渡す時間。 */
export const TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS = 8_000;
/** 基準時間の係数（仮置き）。攻方の1手ごとの、駒を選んで指し、玉方の応手（間を含む）を見る時間。 */
export const TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS = 4_000;
/** 基準時間の係数（仮置き）。初手の王手の候補1つごとの、王手になることを見つけて候補に挙げる時間。 */
export const TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS = 2_000;
/** 基準時間の係数（仮置き）。もっともらしい誤王手1つごとの、玉方の逃れを見つけて捨てる時間。 */
export const TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS = 4_000;
/** 基準時間の係数（仮置き）。深い紛れ1つごとに足す、逃れの先の王手まで読む時間。 */
export const TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS = 6_000;
/**
 * 基準時間に数える、もっともらしい誤王手と深い紛れの上限（仮置き）。
 * 分析器はすべての判断地点の誤王手を数えるので裾が長い（問題集の最大はもっともらしい誤王手41・深い紛れ26）。
 * 人間は正解を見つけた時点で残りの候補を読まないので、上限で打ち切る。
 */
export const TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT = 20;
export const TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT = 10;

/**
 * 0点になる時間の、基準時間に対する倍率（仮置き）。リフレクションと同じく、基準時間の1.2倍以内で速さ72点・1.4倍以内で64点に残る傾き。
 */
export const TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO = 3;

export type TsumeShogiPlayScore = {
  total: number;
  breakdown: {
    accuracy: number;
    speed: number;
  };
};

type TsumeShogiPlayScoreInput = {
  elapsedMs: number;
  wrongCheckCount: number;
  workload: TsumeShogiSolveWorkload;
};

/** 攻方が指す手の数。手数（奇数）の攻方の側。 */
export function countTsumeShogiAttackerMoves(plies: number): number {
  return Math.ceil(Math.max(0, plies) / 2);
}

/**
 * 問題ごとの速さ満点の基準時間。盤面を見渡す時間に、攻方の手の数・初手の王手の候補・もっともらしい誤王手・深い紛れ
 * （どちらも上限あり）に応じた時間を足す。問題を読み切る作業の量だけから決め、難易度そのものは使わない。
 */
export function calculateTsumeShogiSpeedFullScoreMs({
  plies,
  rootChecks,
  plausibleWrong,
  deepDecoyCount,
}: TsumeShogiSolveWorkload): number {
  return (
    TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS +
    countTsumeShogiAttackerMoves(plies) *
      TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS +
    Math.max(0, rootChecks) * TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS +
    Math.min(
      Math.max(0, plausibleWrong),
      TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT,
    ) *
      TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS +
    Math.min(Math.max(0, deepDecoyCount), TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT) *
      TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS
  );
}

/** 0点になる時間。基準時間から、ここまで超過に応じて線形に減らす。 */
export function calculateTsumeShogiSpeedZeroScoreMs(
  workload: TsumeShogiSolveWorkload,
): number {
  return (
    calculateTsumeShogiSpeedFullScoreMs(workload) *
    TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateTsumeShogiTimeDeltaMs({
  elapsedMs,
  workload,
}: Pick<TsumeShogiPlayScoreInput, "elapsedMs" | "workload">): number {
  return elapsedMs - calculateTsumeShogiSpeedFullScoreMs(workload);
}

/**
 * 読みの確かさと速さの和。読みの確かさは誤王手1回ごとに5点減らし（0点まで）、速さは基準時間以内で満点、
 * 超過に応じて線形に減らして基準時間の3倍で0点にする。速さは1点単位に四捨五入する。
 */
export function calculateTsumeShogiPlayScore({
  elapsedMs,
  wrongCheckCount,
  workload,
}: TsumeShogiPlayScoreInput): TsumeShogiPlayScore {
  const accuracy = subtractWithFloor(
    TSUME_SHOGI_SCORE_MAXIMUMS.accuracy,
    Math.max(0, wrongCheckCount) * TSUME_SHOGI_WRONG_CHECK_PENALTY,
  );

  const speedFullScoreMs = calculateTsumeShogiSpeedFullScoreMs(workload);
  const speedZeroScoreMs = calculateTsumeShogiSpeedZeroScoreMs(workload);
  const overtimeMs = Math.max(0, elapsedMs - speedFullScoreMs);
  const speed = calculateLinearScore(
    TSUME_SHOGI_SCORE_MAXIMUMS.speed,
    1 - overtimeMs / (speedZeroScoreMs - speedFullScoreMs),
  );

  return {
    total: accuracy + speed,
    breakdown: { accuracy, speed },
  };
}

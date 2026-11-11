import type { ProblemId } from "@/games/problem-id";
import { type GameResultLevel, gameResultLevels } from "@/games/result";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

/**
 * 前回図鑑を見たときからの変化を、台紙のマスでどう見せるか。
 * - `animated`: 前回の姿から、変化したマスを1つずつ押していく演出で見せる。
 * - `marked`: 動きを減らす設定で、動かさずに今の姿に印を載せて見せる。
 */
export type ZukanChangeAppearance = "animated" | "marked";

/**
 * 変化したマスの、今見せている段階。
 * - `waiting`: まだ押していない。前回の姿で描く。
 * - `stamping`: 押している途中で、まだマスに着いていない。下には前回の姿を残す。
 * - `landed`: マスに着いた。今の姿で描き、押した動きの残りを見せる。
 * - `marked`: 動きを減らす設定で、今の姿に印を載せる。
 */
export type ZukanChangeStage = "waiting" | "stamping" | "landed" | "marked";

/** 押す1マスの、押し方の強さを決める変化。 */
export type ZukanStamp = {
  /** 今の評価段階。 */
  level: GameResultLevel;
  /** 前回解いていて、評価段階が上がったか。 */
  isRaised: boolean;
};

/** 変化したマスの、今の評価段階と前回の状態。押していく演出は、マスに載せたこれを読んで押し方を決める。 */
export function getZukanStamp(
  problem: ZukanProblem,
  change: ZukanProblemChange,
): ZukanStamp | null {
  const status = getZukanProblemStatus(problem);
  return status === "attempted" || status === "untouched"
    ? null
    : { level: status, isRaised: change.kind === "raised" };
}

/** マスの `data-change-level` と `data-change-raised` から、押す変化を読む。 */
export function readZukanStamp(square: Element): ZukanStamp | null {
  const level = square.getAttribute("data-change-level");
  const solvedLevel = gameResultLevels.find((value) => value === level);
  return solvedLevel === undefined
    ? null
    : {
        level: solvedLevel,
        isRaised: square.hasAttribute("data-change-raised"),
      };
}

/**
 * 押す変化の重さ。perfect、段階の上がり、great、good、clear の順に重い。
 * 波ではめる間に、間を空けて鳴らす音で代表する変化を選ぶのに使う。
 */
function getZukanStampWeight({ level, isRaised }: ZukanStamp): number {
  const levelWeight = gameResultLevels.indexOf(level);
  return level === "perfect"
    ? gameResultLevels.length + 1
    : isRaised
      ? gameResultLevels.length
      : levelWeight;
}

/** `stamps` のうち最も重い変化。同じ重さなら先のもの。空なら `null`。 */
export function findZukanHeaviestStamp(
  stamps: readonly ZukanStamp[],
): ZukanStamp | null {
  let heaviest: ZukanStamp | null = null;
  for (const stamp of stamps) {
    if (
      heaviest === null ||
      getZukanStampWeight(stamp) > getZukanStampWeight(heaviest)
    ) {
      heaviest = stamp;
    }
  }
  return heaviest;
}

/**
 * 1枚を押す見せ方。
 * - `hero`: 主役の1枚。行き先の枠を光らせてから、台の離れた所から大きな姿で弧を描いて飛ばし、枠にはめて同心円の波紋を広げる。変化が少ないときに使う。
 * - `featured`: `hero` を小さくしたもの。近くから飛ばしてはめ、ピースの形の波紋を返す。変化がいくらかあるときと、多いときの先頭の数枚。
 * - `wave`: 持ち上げずに、少し大きい姿から縮めてはめる。変化が多いときの、先頭の数枚より後。
 */
export type ZukanStampStyle = "hero" | "featured" | "wave";

/** 1枚の動きの区切り。押し始めてからの時刻で表す。 */
export type ZukanStampTimeline = {
  /** 飛び始める。それまでは行き先の枠だけを光らせる。 */
  flightMs: number;
  /** 現れ終える。 */
  appearedMs: number;
  /** マスに着く。ここで今の姿になり、数を数える。 */
  landMs: number;
  /** はまって行き過ぎた姿から戻り終える。 */
  settledMs: number;
  /** 押す姿を薄れさせ始め、マスの普段の姿を見せ始める。 */
  handOffMs: number;
  /** 押す姿が消え終え、マスの普段の姿だけになる。 */
  handedOffMs: number;
  /** 波紋や明るさまで、その1枚の動きが消える。 */
  endMs: number;
};

const zukanStampTimelines: Record<ZukanStampStyle, ZukanStampTimeline> = {
  // 主役は、開いてすぐ行き先の枠を光らせ始め、溜めてから飛ばす。はまったあとは明るく保ってから戻す。
  hero: {
    flightMs: 240,
    appearedMs: 320,
    landMs: 760,
    settledMs: 1000,
    handOffMs: 870,
    handedOffMs: 1020,
    endMs: 1460,
  },
  featured: {
    flightMs: 0,
    appearedMs: 70,
    landMs: 300,
    settledMs: 460,
    handOffMs: 410,
    handedOffMs: 560,
    endMs: 900,
  },
  // 波は着くのと同時に現れ終え、まだ数えていないマスを、はまった姿と見分けられるよう半ば透かしておく。
  wave: {
    flightMs: 0,
    appearedMs: 120,
    landMs: 120,
    settledMs: 230,
    handOffMs: 230,
    handedOffMs: 380,
    endMs: 380,
  },
};

/** 見せ方 `style` の1枚の動きの区切り。段階によらず同じにし、押していく順と着く順を揃える。 */
export function getZukanStampTimeline(
  style: ZukanStampStyle,
): ZukanStampTimeline {
  return zukanStampTimelines[style];
}

/** この枚数までは、1枚ずつを主役として見せる。 */
const HERO_LIMIT = 3;
/** 主役の1枚の行き先の枠を光らせ始めるまでの時間。開いてすぐ、何かが始まると分かるようにする。 */
const HERO_FIRST_START_MS = 60;
/** 主役が続くときの、着く時刻の間隔。前の1枚がはまるのを見届けてから、次の1枚を飛ばす。 */
const HERO_LAND_INTERVAL_MS = 460;
/** 主役より多いときに、最初の1枚を押し始めるまで待つ時間。 */
const PREVIOUS_STATE_HOLD_MS = 260;
/** 開いてから、最後の1枚の動きが消えるまでの上限。台紙のスクロールを待つ分は含めない。最後の1枚が着くまでは、およそ1.4秒に収まる。 */
const REVEAL_DURATION_MAX_MS = 2000;
/** この枚数までは、全部を1枚ずつ押す。 */
const FEATURED_ALL_LIMIT = 10;
/** 枚数が多いときに、波の前に1枚ずつ押す枚数と、その着く間隔。 */
const FEATURED_LEAD_COUNT = 6;
const FEATURED_LEAD_INTERVAL_MS = 70;
/** 全部を1枚ずつ押すときの、着く間隔の範囲。少ないほど1枚ずつをじっくり見せる。 */
const FEATURED_INTERVAL_MS = { min: 85, max: 180 } as const;
/** perfect の前に置く間と、間を置く数の上限。全部を1枚ずつ押すときだけ置く。 */
const PERFECT_PAUSE_MS = 150;
const PAUSED_STAMP_LIMIT = 2;
/** 波でまとめてはめる長さの上限と、1枚あたりの長さ。少ない枚数の波は、1枚あたりの長さで短く流す。 */
const WAVE_SPAN_MAX_MS = 450;
const WAVE_STEP_MS = 50;
/** 波の最初の1枚が、1枚ずつ押した最後の1枚より後に着く間。 */
const WAVE_AFTER_FEATURED_GAP_MS = 40;

/** 押していく順の、1枚の変化と台紙の中の位置。 */
export type ZukanStampChange = { index: number; stamp: ZukanStamp };

/** 1枚を押す見せ方と時刻。台紙を開いてからの経過で表す。スクロールを待つ間は後へずれる。 */
export type ZukanStampStep = {
  style: ZukanStampStyle;
  startMs: number;
  landMs: number;
  endMs: number;
};

/**
 * 押していく順の変化 `changes` から、1枚ずつの見せ方と時刻を決める。
 * 時刻は着く時刻から決め、押していく順に着かせる。数は押していく順に数えるので、着いたマスと数がずれないようにする。
 * 3枚までは、1枚ずつを主役として見せる。開いてすぐ行き先の枠を光らせ始め、画面が落ち着いてから飛ばす。
 * 10枚までは全部を1枚ずつ押し、多いほど間隔を詰める。perfect の前には間を置く。
 * それより多ければ、先頭の数枚を1枚ずつ押し、残りを波で等しい間隔にまとめてはめる。
 */
export function planZukanStamps(
  changes: readonly ZukanStampChange[],
): ZukanStampStep[] {
  if (changes.length <= HERO_LIMIT) {
    return planHeroStamps(changes);
  }
  return changes.length <= FEATURED_ALL_LIMIT
    ? planFeaturedStamps(changes)
    : planLeadAndWaveStamps(changes);
}

function toStep(style: ZukanStampStyle, landMs: number): ZukanStampStep {
  const timeline = getZukanStampTimeline(style);
  const startMs = landMs - timeline.landMs;
  return {
    style,
    startMs: Math.round(startMs),
    landMs: Math.round(landMs),
    endMs: Math.round(startMs + timeline.endMs),
  };
}

function planHeroStamps(
  changes: readonly ZukanStampChange[],
): ZukanStampStep[] {
  const firstLandMs =
    HERO_FIRST_START_MS + getZukanStampTimeline("hero").landMs;
  return changes.map((_, order) =>
    toStep("hero", firstLandMs + order * HERO_LAND_INTERVAL_MS),
  );
}

function planFeaturedStamps(
  changes: readonly ZukanStampChange[],
): ZukanStampStep[] {
  const { landMs, endMs } = getZukanStampTimeline("featured");
  let pausedCount = 0;
  const pauses = changes.map(({ stamp }, order): number => {
    if (
      stamp.level !== "perfect" ||
      order === 0 ||
      pausedCount >= PAUSED_STAMP_LIMIT
    ) {
      return 0;
    }
    pausedCount += 1;
    return PERFECT_PAUSE_MS;
  });
  const totalPauseMs = pauses.reduce((total, pause) => total + pause, 0);
  const firstLandMs = PREVIOUS_STATE_HOLD_MS + landMs;
  const tailMs = endMs - landMs;
  const intervalMs = Math.max(
    FEATURED_INTERVAL_MS.min,
    Math.min(
      FEATURED_INTERVAL_MS.max,
      (REVEAL_DURATION_MAX_MS - firstLandMs - tailMs - totalPauseMs) /
        Math.max(1, changes.length - 1),
    ),
  );
  let pausedMs = 0;
  return changes.map((_, order) => {
    pausedMs += pauses[order] ?? 0;
    return toStep("featured", firstLandMs + order * intervalMs + pausedMs);
  });
}

function planLeadAndWaveStamps(
  changes: readonly ZukanStampChange[],
): ZukanStampStep[] {
  const firstLandMs =
    PREVIOUS_STATE_HOLD_MS + getZukanStampTimeline("featured").landMs;
  const lead = changes
    .slice(0, FEATURED_LEAD_COUNT)
    .map((_, order) =>
      toStep("featured", firstLandMs + order * FEATURED_LEAD_INTERVAL_MS),
    );
  const wave = changes.slice(FEATURED_LEAD_COUNT);
  const waveFirstLandMs =
    (lead.at(-1)?.landMs ?? 0) + WAVE_AFTER_FEATURED_GAP_MS;
  const waveSpanMs = Math.min(
    WAVE_SPAN_MAX_MS,
    (wave.length - 1) * WAVE_STEP_MS,
  );
  const lastOrder = wave.length - 1;
  // 波は数え上げが目で追えるよう、等しい間隔で1枚ずつ着かせる。
  return [
    ...lead,
    ...wave.map((_, order) =>
      toStep(
        "wave",
        waveFirstLandMs +
          (lastOrder === 0 ? 0 : (waveSpanMs * order) / lastOrder),
      ),
    ),
  ];
}

/** 演出を描く層の中の位置。 */
export type ZukanStampPoint = { x: number; y: number };

/** 演出を描く層の中の、台の見えている範囲。 */
export type ZukanLayerView = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** 主役の1枚を飛ばし始める所の、見えている範囲の端からの距離（ピースの1辺に対する比）。大きく飛ぶ姿が台の端で切れない幅。 */
const HERO_LAUNCH_MARGIN_RATIO = 1.1;
/** 主役の1枚を飛ばす距離の範囲（ピースの1辺に対する比）。近すぎると飛んだと見えず、遠すぎると目で追えない。 */
const HERO_LAUNCH_DISTANCE_RATIO = { min: 4, max: 10 } as const;
/** `featured` を飛ばす距離と、見えている範囲の端からの距離（ピースの1辺に対する比）。 */
const FEATURED_LAUNCH = { distanceRatio: 2.5, marginRatio: 0.8 } as const;
/** 波ではめる1枚を寄せてくる距離（ピースの1辺に対する比）。 */
const WAVE_LAUNCH_DISTANCE_RATIO = 0.7;

function clampToView(
  point: ZukanStampPoint,
  view: ZukanLayerView,
  margin: number,
): ZukanStampPoint {
  return {
    x: Math.min(Math.max(point.x, view.left + margin), view.right - margin),
    y: Math.min(Math.max(point.y, view.top + margin), view.bottom - margin),
  };
}

/** `from` から `to` への向きの単位ベクトル。同じ所なら下向き。 */
function directionOf(
  from: ZukanStampPoint,
  to: ZukanStampPoint,
): ZukanStampPoint {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length < 1
    ? { x: 0, y: 1 }
    : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/**
 * 主役の1枚を飛ばし始める所。台の下端寄りのうち、枠から最も遠い所から飛ばす。
 * 枠が下端に近く遠い所が無ければ、上端寄りも含めて最も遠い所にし、遠すぎれば枠へ寄せる。
 */
export function findZukanHeroLaunchPoint(
  slot: ZukanStampPoint & { size: number },
  view: ZukanLayerView,
): ZukanStampPoint {
  const margin = slot.size * HERO_LAUNCH_MARGIN_RATIO;
  const xs = [
    view.left + margin,
    (view.left + view.right) / 2,
    view.right - margin,
  ];
  const bottom = xs.map((x) => ({ x, y: view.bottom - margin }));
  const top = xs.map((x) => ({ x, y: view.top + margin }));
  function distanceTo(point: ZukanStampPoint): number {
    return Math.hypot(point.x - slot.x, point.y - slot.y);
  }
  function farthest(points: readonly ZukanStampPoint[]): ZukanStampPoint {
    return points.reduce((best, point) =>
      distanceTo(point) > distanceTo(best) ? point : best,
    );
  }
  const fromBottom = farthest(bottom);
  const launch =
    distanceTo(fromBottom) >= slot.size * HERO_LAUNCH_DISTANCE_RATIO.min
      ? fromBottom
      : farthest([...bottom, ...top]);
  const maxDistance = slot.size * HERO_LAUNCH_DISTANCE_RATIO.max;
  const distance = distanceTo(launch);
  if (distance <= maxDistance) {
    return launch;
  }
  const direction = directionOf(slot, launch);
  return {
    x: slot.x + direction.x * maxDistance,
    y: slot.y + direction.y * maxDistance,
  };
}

/** `featured` を飛ばし始める所。枠から見えている範囲の真ん中の向きへ少し離れた所にし、見えている範囲に収める。 */
export function findZukanFeaturedLaunchPoint(
  slot: ZukanStampPoint & { size: number },
  view: ZukanLayerView,
): ZukanStampPoint {
  const center = {
    x: (view.left + view.right) / 2,
    y: (view.top + view.bottom) / 2,
  };
  const direction = directionOf(slot, center);
  const distance = slot.size * FEATURED_LAUNCH.distanceRatio;
  return clampToView(
    { x: slot.x + direction.x * distance, y: slot.y + direction.y * distance },
    view,
    slot.size * FEATURED_LAUNCH.marginRatio,
  );
}

/** 波ではめる1枚を寄せてくる所。先にはめた数枚の真ん中 `origin` の側から、外へ押し出されるように寄せる。 */
export function findZukanWaveLaunchPoint(
  slot: ZukanStampPoint & { size: number },
  origin: ZukanStampPoint,
): ZukanStampPoint {
  const direction = directionOf(origin, slot);
  const distance = slot.size * WAVE_LAUNCH_DISTANCE_RATIO;
  return {
    x: slot.x - direction.x * distance,
    y: slot.y - direction.y * distance,
  };
}

/**
 * 押すマスを見えているものとする、台紙の見える範囲の端からの距離。台紙の上下の余白と同じ幅にする。
 * 上端の余白には台紙の頭の帯が重なるので、それより内側のマスだけを押し、浮いた姿と影が帯の下に切れないようにする。
 */
const REVEAL_SCROLL_MARGIN_PX = 16;
/** 波を追うスクロールで、波の先頭を置く、見える範囲の上からの割合。 */
const WAVE_FRONT_VIEW_RATIO = 0.6;

/** 台紙のスクロール領域で見えている範囲や、マスの範囲の上下の位置。比べる範囲どうしは同じ基準で測る。 */
export type ZukanVerticalSpan = { top: number; bottom: number };

export function joinZukanVerticalSpans(
  spans: readonly ZukanVerticalSpan[],
): ZukanVerticalSpan | null {
  if (spans.length === 0) {
    return null;
  }
  return {
    top: Math.min(...spans.map(({ top }) => top)),
    bottom: Math.max(...spans.map(({ bottom }) => bottom)),
  };
}

/** 押すマスの範囲 `target` が、見えている範囲 `view` の中に、浮いた姿が端で切れない余白を空けて入っているか。 */
export function isZukanStampTargetVisible(
  view: ZukanVerticalSpan,
  target: ZukanVerticalSpan,
): boolean {
  return (
    target.top >= view.top + REVEAL_SCROLL_MARGIN_PX &&
    target.bottom <= view.bottom - REVEAL_SCROLL_MARGIN_PX
  );
}

/**
 * 押すマスの範囲 `target` が、端から余白を空けて見えるようにする台紙のスクロール位置。既に見えていれば `null`。
 * 範囲が見える範囲に入るなら、動かす量が最も小さい位置にする。入らなければ、範囲の先頭を見える範囲の上端に寄せ、後に続くマスをなるべく多く見せる。
 */
export function findZukanRevealScrollTop(
  view: ZukanVerticalSpan,
  scrollTop: number,
  target: ZukanVerticalSpan,
): number | null {
  const margin = REVEAL_SCROLL_MARGIN_PX;
  if (isZukanStampTargetVisible(view, target)) {
    return null;
  }
  const fits =
    target.bottom - target.top + margin * 2 <= view.bottom - view.top;
  const offset =
    fits && target.bottom > view.bottom - margin
      ? target.bottom - (view.bottom - margin)
      : target.top - (view.top + margin);
  return Math.max(0, scrollTop + offset);
}

/**
 * 波でまとめてはめている間に、波の先頭 `front` を追う台紙のスクロール位置。先頭を見える範囲の上から決まった割合の所に置く。
 * 最後にはめるマス `last` が見えるより先へは進めず、戻る向きには動かさない。
 */
export function findZukanWaveScrollTop(
  view: ZukanVerticalSpan,
  scrollTop: number,
  front: ZukanVerticalSpan,
  last: ZukanVerticalSpan,
): number {
  const frontOffset =
    front.top - view.top - (view.bottom - view.top) * WAVE_FRONT_VIEW_RATIO;
  const lastOffset = last.bottom - (view.bottom - REVEAL_SCROLL_MARGIN_PX);
  return scrollTop + Math.max(0, Math.min(frontOffset, lastOffset));
}

/** 台紙の行の並び。`alignedScrollTop` は、ある行の上端を見える範囲の上端に揃えるスクロール位置、`pitch` は行の間隔。 */
export type ZukanSheetRows = { alignedScrollTop: number; pitch: number };

/**
 * スクロール位置 `scrollTop` に最も近い、行の上端が見える範囲の上端に揃う位置。`maxScrollTop` を超えるなら、超えない位置にする。
 * 止まった台紙の上端で、行が台紙の頭の帯の下に半端に切れて見えないようにする。
 */
export function snapZukanScrollTopToRows(
  scrollTop: number,
  { alignedScrollTop, pitch }: ZukanSheetRows,
  maxScrollTop: number,
): number {
  if (pitch <= 0) {
    return scrollTop;
  }
  const rowCount = Math.round((scrollTop - alignedScrollTop) / pitch);
  const nearest = alignedScrollTop + rowCount * pitch;
  const withinMax =
    nearest > maxScrollTop
      ? alignedScrollTop +
        Math.floor((maxScrollTop - alignedScrollTop) / pitch) * pitch
      : nearest;
  return Math.max(0, withinMax);
}

/** まだ見せていない変化 `pendingChange` があれば前回の姿、無ければ今の姿。 */
export function getZukanShownProblemStatus(
  problem: ZukanProblem,
  pendingChange: ZukanProblemChange | undefined,
): ZukanProblemStatus {
  return pendingChange === undefined
    ? getZukanProblemStatus(problem)
    : pendingChange.previousStatus;
}

/** 変化のうち、新しく解いた問題の数。 */
export function countZukanNewlySolved(
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined,
): number {
  let count = 0;
  for (const { kind } of changes?.values() ?? []) {
    if (kind === "newly-solved") {
      count += 1;
    }
  }
  return count;
}

import type { ReactNode } from "react";
import type {
  ProblemFeature,
  ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import type { ClearedProblemSource } from "@/features/records/cleared-problem";
import type { PlayAttempt } from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";
import type { PlayRecordDisplayDefinition } from "@/features/records/ui/play-record-display";
import type { ZukanGameSource } from "@/features/zukan/zukan-collection";
import type { DifficultyLevel } from "@/games/difficulty";
import type { ResultRecordFeedback } from "@/games/play";
import type {
  ProblemFeatureAxis,
  ProblemFeatureValue,
} from "@/games/problem-feature";
import {
  createProblemId,
  type ProblemId,
  type ProblemIdentity,
} from "@/games/problem-id";
import type { Path } from "@/router";

export type GameHomePath = Exclude<
  Extract<Path, `/puzzles/${string}`>,
  `${string}/:${string}`
>;

export type GamePlayPath = Extract<Path, `/puzzles/${string}/play/:difficulty`>;

export type RecordProblemPlayTarget = {
  difficulty: string;
  problemId: ProblemId;
};

export type RecordProblemPlayDestination = RecordProblemPlayTarget & {
  playPath: GamePlayPath;
};

export type GameNavigation = {
  openGameHome: (
    selectedProblemId?: ProblemId,
    options?: { replacesHistory: boolean },
  ) => void;
  backToAppHome: () => void;
  startNewProblem: (
    difficulty: string,
    avoidedProblemId: ProblemId,
    options?: { replacesHistory: boolean },
  ) => void;
};

/** 検証情報はゲームが記録から用意する。 */
export type RecordResultContext = {
  recordFeedback: ResultRecordFeedback;
  /** 遊び直せない記録では `undefined`。 */
  onReplay: (() => void) | undefined;
  navigation: GameNavigation;
};

export type ProblemFeatureFilterAxis = {
  id: string;
  countRangeWidth?: number;
  display: ProblemFeatureAxisDisplay;
};

export type ProblemFeatureFilter = {
  /** 示す順に並ぶ。 */
  axes: readonly ProblemFeatureFilterAxis[];
  /**
   * 問題集に無い ID・別の難易度の ID には `null` を返す。
   * 図鑑で開いているレベルの全問について求めるので、問題を復元せず問題集の項目から求める。
   */
  findPoolProblemValues: (
    difficulty: DifficultyLevel,
    problemId: ProblemId,
  ) => ReadonlyMap<string, ProblemFeatureValue> | null;
};

export type GameCatalogEntry = {
  /** 記録の `gameId` と同じ値。 */
  id: string;
  name: string;
  pictogramSvg: string;
  /** 持たないゲームは `pictogramSvg` を見せる。 */
  pictogramShowcaseSvg?: string;
  homePath: GameHomePath;
  playPath: GamePlayPath;
  playRecordDisplay: PlayRecordDisplayDefinition;
  /** 遊び直せない記録には `null` を返す。 */
  recordProblemPlayTarget: (
    record: PlayRecord,
  ) => RecordProblemPlayTarget | null;
  /** 遊び直せない試行には `null` を返す。 */
  attemptProblemPlayTarget: (
    attempt: PlayAttempt,
  ) => RecordProblemPlayTarget | null;
  /** 問題集の並び順で返す。 */
  listPoolProblemIds: (difficulty: DifficultyLevel) => readonly ProblemId[];
  /**
   * 問題集に無い ID・別の難易度の ID には `null` を返す。
   * 図鑑で選んだ1問について求めるので、重い生成・解析をせず問題集の項目から求める。
   */
  describePoolProblem: (
    difficulty: DifficultyLevel,
    problemId: ProblemId,
  ) => readonly ProblemFeature[] | null;
  problemFeatureFilter: ProblemFeatureFilter;
  /** `renderRecordResult` が結果画面を返すときだけ `true`。 */
  hasRecordResult: (record: PlayRecord) => boolean;
  /**
   * 呼び出し側は記録の `gameId` がこのゲームの `id` と一致することを確かめてから渡す。
   */
  renderRecordResult: (
    record: PlayRecord,
    context: RecordResultContext,
  ) => ReactNode | null;
};

export function toClearedProblemSource(
  game: GameCatalogEntry,
): ClearedProblemSource {
  return {
    id: game.id,
    recordProblemPlayTarget: game.recordProblemPlayTarget,
    playRecordDefinition: game.playRecordDisplay.definition,
  };
}

export function toZukanGameSource(game: GameCatalogEntry): ZukanGameSource {
  return {
    id: game.id,
    listPoolProblemIds: game.listPoolProblemIds,
    recordProblemPlayTarget: game.recordProblemPlayTarget,
    attemptProblemPlayTarget: game.attemptProblemPlayTarget,
    playRecordDefinition: game.playRecordDisplay.definition,
  };
}

/**
 * 難易度が今の難易度区分に無い（`undefined`）か、その難易度の問題集で問題 ID を引けなければ `null` を返す。
 */
export function resolveRecordProblemPlayTarget<Difficulty extends string>(
  difficulty: Difficulty | undefined,
  problemIdentity: ProblemIdentity,
  canSelectProblemById: (
    difficulty: Difficulty,
    problemId: ProblemId,
  ) => boolean,
): RecordProblemPlayTarget | null {
  if (difficulty === undefined) {
    return null;
  }

  const problemId = createProblemId(problemIdentity);
  return canSelectProblemById(difficulty, problemId)
    ? { difficulty, problemId }
    : null;
}

export function createProblemFeatureFilter<Features, Id extends string>(
  findPoolProblemFeatures: (
    difficulty: DifficultyLevel,
    problemId: ProblemId,
  ) => Features | null,
  axes: readonly ProblemFeatureAxis<Features, Id>[],
  displays: Readonly<Record<Id, ProblemFeatureAxisDisplay>>,
): ProblemFeatureFilter {
  return {
    axes: axes.map(({ id }) => {
      const display = displays[id];
      return {
        id,
        countRangeWidth:
          display.valueFormat.kind === "count"
            ? display.valueFormat.rangeWidth
            : undefined,
        display,
      };
    }),
    findPoolProblemValues(difficulty, problemId) {
      const features = findPoolProblemFeatures(difficulty, problemId);
      return features === null
        ? null
        : new Map(axes.map((axis) => [axis.id, axis.getValue(features)]));
    },
  };
}
